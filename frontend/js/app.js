/**
 * INAPYMI – Sistema de Registro Post-Sismo
 * Lógica principal: autenticación, roles, CRUD, escritura dual en backends
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════════
   CONFIGURACIÓN DE BACKENDS
   ═══════════════════════════════════════════════════════════════════ */
const API_NODE = 'http://localhost:3001/api';

/* ═══════════════════════════════════════════════════════════════════
   ESTADO GLOBAL
   ═══════════════════════════════════════════════════════════════════ */
let currentUser  = null;
let editingId    = null;
let deleteId     = null;
let nodeOnline   = false;

const ESTADOS_VENEZUELA = [
  'Amazonas','Anzoátegui','Apure','Aragua','Barinas','Bolívar',
  'Carabobo','Cojedes','Delta Amacuro','Distrito Capital (Caracas)',
  'Falcón','Guárico','La Guaira (Vargas)','Lara','Mérida','Miranda',
  'Monagas','Nueva Esparta','Portuguesa','Sucre','Táchira','Trujillo',
  'Yaracuy','Zulia'
];

/* ═══════════════════════════════════════════════════════════════════
   INICIALIZACIÓN
   ═══════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  generarParticulas();
  initLogin();
  initModales();
  initEstadoSelector();
  verificarBackends();
  setInterval(verificarBackends, 15000);

  // Menu toggle (mobile)
  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Cerrar sidebar al hacer click fuera (mobile)
  document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar.contains(e.target) && !document.getElementById('menuToggle').contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });

  // ⇒ Restaurar sesión: esperar al health-check para que nodeOnline esté actualizado
  const sesionGuardada = localStorage.getItem('inapymi_user');
  if (sesionGuardada) {
    try {
      currentUser = JSON.parse(sesionGuardada);
      // Esperar que verificarBackends termine antes de cargar la página
      verificarBackends().then(() => iniciarApp());
    } catch (e) {
      localStorage.removeItem('inapymi_user');
    }
  }
});

/* ─── Partículas decorativas ────────────────────────────────────── */
function generarParticulas() {
  const container = document.getElementById('particles');
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('span');
    p.style.left = Math.random() * 100 + '%';
    p.style.top  = Math.random() * 100 + '%';
    p.style.animationDelay = Math.random() * 8 + 's';
    p.style.animationDuration = (6 + Math.random() * 6) + 's';
    container.appendChild(p);
  }
}

/* ─── Poblar select de estados en búsqueda ──────────────────────── */
function initEstadoSelector() {
  const sel = document.getElementById('filterEstado');
  ESTADOS_VENEZUELA.forEach(e => {
    const op = document.createElement('option');
    op.value = e; op.textContent = e;
    sel.appendChild(op);
  });
}

/* ═══════════════════════════════════════════════════════════════════
   AUTENTICACIÓN
   ═══════════════════════════════════════════════════════════════════ */
function initLogin() {
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value;

    if (!username || !password) {
      mostrarLoginError('Ingrese usuario y contraseña.');
      return;
    }

    setLoading(btn, true);
    document.getElementById('loginError').style.display = 'none';

    // Intentar login en Node
    let user = null;
    try {
      const res = await fetchJSON(`${API_NODE}/login`, 'POST', { username, password });
      user = res.user;
    } catch (err) {
      setLoading(btn, false);
      mostrarLoginError(err.message || 'No se pudo conectar al servidor.');
      return;
    }

    setLoading(btn, false);
    if (!user) {
      mostrarLoginError('Credenciales inválidas.');
      return;
    }

    currentUser = user;
    localStorage.setItem('inapymi_user', JSON.stringify(user)); // Persistir sesión
    iniciarApp();
  });
}

function mostrarLoginError(msg) {
  document.getElementById('loginErrorMsg').textContent = msg;
  document.getElementById('loginError').style.display = 'flex';
}

function iniciarApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appLayout').classList.add('visible');

  // Establecer datos del usuario en el sidebar
  document.getElementById('userName').textContent  = `${currentUser.nombre} ${currentUser.apellido}`;
  document.getElementById('userAvatar').textContent = (currentUser.nombre[0] || 'U').toUpperCase();
  document.getElementById('userRol').textContent    = labelRol(currentUser.rol);

  renderizarNav();
  
  // Navegar a la primera página disponible según el rol
  const items = navConfig[currentUser.rol] || [];
  if (items.length > 0) {
    navegarA(items[0].id);
  }
}

function labelRol(rol) {
  return { administrador: 'Administrador', atencion: 'Atención al Ciudadano', trabajador: 'Trabajador' }[rol] || rol;
}

document.getElementById('logoutBtn').addEventListener('click', cerrarSesion);

function cerrarSesion() {
  currentUser = null;
  localStorage.removeItem('inapymi_user'); // Limpiar sesión guardada
  document.getElementById('appLayout').classList.remove('visible');
  document.getElementById('loginScreen').style.display = '';
  document.getElementById('loginForm').reset();
  document.getElementById('loginError').style.display = 'none';
}

/* ═══════════════════════════════════════════════════════════════════
   NAVEGACIÓN POR ROLES
   ═══════════════════════════════════════════════════════════════════ */
const navConfig = {
  administrador: [
    { id: 'page-dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'page-lista',     icon: '📋', label: 'Trabajadores' },
    { id: 'page-auditoria', icon: '🔎', label: 'Auditoría' },
    { id: 'page-usuarios',  icon: '👥', label: 'Usuarios' },
  ],
  atencion: [
    { id: 'page-dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'page-lista',     icon: '📋', label: 'Trabajadores' },
  ],
  trabajador: [
    { id: 'page-perfil',    icon: '🪪', label: 'Mi Información' },
  ]
};

function renderizarNav() {
  const nav = document.getElementById('sidebarNav');
  nav.innerHTML = '';
  const items = navConfig[currentUser.rol] || [];
  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'nav-item';
    btn.dataset.page = item.id;
    btn.innerHTML = `<span class="nav-icon">${item.icon}</span>${item.label}`;
    btn.addEventListener('click', () => navegarA(item.id, btn));
    nav.appendChild(btn);
  });

  // Mostrar botón "Nuevo Registro" para admin y atencion
  if (['administrador','atencion'].includes(currentUser.rol)) {
    document.getElementById('btnNuevoWrap').style.display = 'block';
  }
}

function navegarA(pageId, btnEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

  const page = document.getElementById(pageId);
  if (page) page.classList.add('active');

  if (btnEl) btnEl.classList.add('active');
  else {
    const btn = document.querySelector(`[data-page="${pageId}"]`);
    if (btn) btn.classList.add('active');
  }

  // Cargar datos de la página
  if (pageId === 'page-dashboard')  cargarDashboard();
  if (pageId === 'page-lista')      cargarLista();
  if (pageId === 'page-auditoria')  cargarAuditoria();
  if (pageId === 'page-usuarios')   cargarUsuarios();
  if (pageId === 'page-perfil')     cargarPerfil();

  // Actualizar topbar
  const icons = { 'page-dashboard':'📊','page-lista':'📋','page-auditoria':'🔎','page-usuarios':'👥','page-perfil':'🪪' };
  const labels = { 'page-dashboard':'Dashboard','page-lista':'Trabajadores','page-auditoria':'Auditoría','page-usuarios':'Usuarios','page-perfil':'Mi Información' };
  document.getElementById('topbarIcon').textContent  = icons[pageId]  || '📋';
  document.getElementById('topbarTitle').textContent = labels[pageId] || '';
}

/* ═══════════════════════════════════════════════════════════════════
   VERIFICACIÓN DE BACKENDS
   ═══════════════════════════════════════════════════════════════════ */
async function verificarBackends() {
  nodeOnline = await checkHealth(API_NODE);

  const nodeDot = document.getElementById('nodeStatus');
  if(nodeDot) nodeDot.className = 'dot-indicator ' + (nodeOnline ? 'online' : 'offline');
  
  const phpDot = document.getElementById('phpStatus');
  if (phpDot) phpDot.style.display = 'none';
}

async function checkHealth(base) {
  try {
    const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch { return false; }
}

/* ═══════════════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════════════ */
async function cargarDashboard() {
  try {
    const stats = await apiFetch('/estadisticas');
    document.getElementById('statTotal').textContent      = stats.total      ?? 0;
    document.getElementById('statFallecidos').textContent = stats.fallecidos ?? 0;
    document.getElementById('statHeridos').textContent    = stats.heridos    ?? 0;
    document.getElementById('statEstados').textContent    = stats.porEstado?.length ?? 0;
  } catch { /* silencioso */ }

  // Últimos 5 registros
  try {
    const lista = await apiFetch('/trabajadores');
    const tbody = document.getElementById('dashTableBody');
    const top5  = lista.slice(0, 5);
    if (!top5.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📋</div><h3>Sin registros aún</h3><p>Comience registrando trabajadores</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = top5.map(t => `
      <tr>
        <td><strong>${t.nombres} ${t.apellidos}</strong></td>
        <td><span class="badge badge-gris">${t.cedula}</span></td>
        <td>${t.estado_laboral}</td>
        <td>${t.ciudad_trabajo}</td>
        <td>${t.hubo_fallecidos ? '<span class="badge badge-rojo">⚰️ Sí</span>' : '<span class="badge badge-verde">✅ No</span>'}</td>
        <td>${t.hubo_heridos   ? '<span class="badge badge-dorado">🏥 Sí</span>' : '<span class="badge badge-verde">✅ No</span>'}</td>
        <td style="font-size:0.78rem;color:var(--texto-muted)">${formatFecha(t.creado_en)}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   LISTA DE TRABAJADORES
   ═══════════════════════════════════════════════════════════════════ */
async function cargarLista(params = {}) {
  const tbody = document.getElementById('listaTableBody');
  tbody.innerHTML = `<tr><td colspan="10"><div class="loader-wrap"><div class="loader"></div></div></td></tr>`;

  try {
    const qs = new URLSearchParams(params).toString();
    const lista = await apiFetch(`/trabajadores${qs ? '?'+qs : ''}`);

    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><div class="empty-icon">📋</div><h3>No se encontraron registros</h3><p>Intente con otros filtros o registre un nuevo trabajador</p></div></td></tr>`;
      return;
    }

    const puedeEditar   = ['administrador','atencion'].includes(currentUser.rol);
    const puedeEliminar = currentUser.rol === 'administrador';

    tbody.innerHTML = lista.map((t, i) => {
      let certHtml = '<span class="badge badge-gris">Pendiente</span>';
      if (t.cert_estado === 'en_revision') certHtml = '<span class="badge badge-dorado" title="Revisado por '+t.cert_nombre_revisor+'">En Revisión</span>';
      else if (t.cert_estado === 'certificado') certHtml = '<span class="badge badge-verde" title="Certificado por '+t.cert_nombre_revisor+'">Certificado</span>';

      return `
      <tr>
        <td style="color:var(--texto-muted);font-size:0.78rem">${i+1}</td>
        <td>
          <strong style="display:block">${t.nombres} ${t.apellidos}</strong>
          <span style="font-size:0.75rem;color:var(--texto-muted)">${formatFecha(t.fecha_nacimiento)}</span>
        </td>
        <td><span class="badge badge-azul">${t.cedula}</span></td>
        <td>
          <span style="display:block;font-weight:600;font-size:0.83rem">${t.cargo}</span>
          <span style="font-size:0.75rem;color:var(--texto-muted)">${t.gerencia}</span>
        </td>
        <td>
          <span style="display:block">${t.estado_laboral}</span>
          <span style="font-size:0.75rem;color:var(--texto-muted)">${t.ciudad_trabajo}${t.torre_trabajo ? ' / '+t.torre_trabajo : ''}</span>
        </td>
        <td style="max-width:180px;font-size:0.8rem">${truncar(t.condicion_vivienda, 60)}</td>
        <td>${t.hubo_fallecidos ? '<span class="badge badge-rojo">⚰️ Sí</span>' : '<span class="badge badge-verde">No</span>'}</td>
        <td>${t.hubo_heridos   ? '<span class="badge badge-dorado">🏥 Sí</span>' : '<span class="badge badge-verde">No</span>'}</td>
        <td>${certHtml}</td>
        <td>
          <div class="actions">
            <button class="btn btn-secondary btn-sm" title="Ver detalle" onclick="verDetalle(${t.id})">👁️</button>
            ${puedeEditar ? `
              ${t.cert_estado !== 'certificado' ? `<button class="btn btn-primary btn-sm" title="Editar" onclick="abrirModalEditar(${t.id})">✏️</button>` : ''}
              ${t.cert_estado === 'pendiente' ? `<button class="btn btn-secondary btn-sm" title="Poner en revisión" onclick="cambiarCert(${t.id}, 'en-revision')">⏳</button>` : ''}
              ${t.cert_estado === 'en_revision' ? `<button class="btn btn-success btn-sm" style="background:#16a34a;color:white;border:none" title="Certificar" onclick="cambiarCert(${t.id}, 'certificar')">✅</button>` : ''}
            ` : ''}
            ${t.cert_estado === 'certificado' ? `<button class="btn btn-primary btn-sm" title="Ver PDF" onclick="abrirCertificado(${t.id})">📄</button>` : ''}
            ${t.cert_estado === 'certificado' && currentUser.rol === 'administrador' ? `<button class="btn btn-danger btn-sm" title="Revertir certificación" onclick="cambiarCert(${t.id}, 'descertificar')">↩️</button>` : ''}
            ${puedeEliminar ? `<button class="btn btn-danger btn-sm" title="Desactivar" onclick="confirmarEliminar(${t.id})">🗑️</button>` : ''}
          </div>
        </td>
      </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="10"><div class="alert alert-danger" style="margin:16px">⚠️ ${err.message}</div></td></tr>`;
  }
}

async function cambiarCert(id, accion) {
  let mensaje = '';
  if (accion === 'en-revision') mensaje = '¿Marcar este registro como EN REVISIÓN?';
  if (accion === 'certificar') mensaje = '¿Desea CERTIFICAR este registro? Esto emitirá el certificado final.';
  if (accion === 'descertificar') mensaje = '¿Desea REVERTIR la certificación? El registro volverá a estado pendiente.';

  if (!confirm(mensaje)) return;

  try {
    const res = await fetchJSON(`${API_NODE}/trabajadores/${id}/${accion}`, 'POST', { usuario_id: currentUser.id });
    toast('success', 'Éxito', res.message);
    cargarLista();
  } catch (err) {
    toast('error', 'Error', err.message);
  }
}

async function abrirCertificado(id) {
  // Obtenemos los datos del trabajador para pasarlos por URL al PDF (en un escenario real podría ser un GET)
  try {
    const list = await apiFetch(`/trabajadores`);
    const t = list.find(x => x.id === id);
    if (!t) return toast('error', 'Error', 'No encontrado');
    const qs = new URLSearchParams(t).toString();
    window.open(`certificado.html?${qs}`, '_blank', 'width=840,height=900');
  } catch (err) {
    toast('error', 'Error', err.message);
  }
}

function buscarTrabajadores() {
  const buscar = document.getElementById('searchInput').value.trim();
  const estado = document.getElementById('filterEstado').value;
  cargarLista({ buscar, estado });
}

function limpiarBusqueda() {
  document.getElementById('searchInput').value = '';
  document.getElementById('filterEstado').value = '';
  cargarLista();
}

// Búsqueda en tiempo real (debounce)
document.getElementById('searchInput').addEventListener('input', debounce(buscarTrabajadores, 400));

/* ═══════════════════════════════════════════════════════════════════
   MODAL FORMULARIO DE REGISTRO
   ═══════════════════════════════════════════════════════════════════ */
function initModales() {
  // Mostrar/ocultar campo de torre según estado seleccionado
  document.getElementById('regEstado').addEventListener('change', function() {
    const esDistritoCapital = this.value === 'Distrito Capital (Caracas)';
    document.getElementById('torraWrap').style.display = esDistritoCapital ? 'block' : 'none';
    document.getElementById('regTorre').required = esDistritoCapital;
    if (!esDistritoCapital) document.getElementById('regTorre').value = '';
  });
}

function abrirModalNuevo() {
  editingId = null;
  document.getElementById('modalRegistroTitle').textContent = 'Nuevo Registro de Trabajador';
  document.getElementById('formRegistro').reset();
  document.getElementById('torraWrap').style.display = 'none';
  document.getElementById('regId').value = '';
  abrirModal('modalRegistro');
}

async function abrirModalEditar(id) {
  try {
    const t = await apiFetch(`/trabajadores/${id}`);
    editingId = id;
    document.getElementById('modalRegistroTitle').textContent = 'Editar Registro';
    document.getElementById('regId').value           = t.id;
    document.getElementById('regNombres').value      = t.nombres;
    document.getElementById('regApellidos').value    = t.apellidos;
    document.getElementById('regCedula').value       = t.cedula;
    document.getElementById('regFechaNac').value     = t.fecha_nacimiento;
    document.getElementById('regCargo').value        = t.cargo;
    document.getElementById('regGerencia').value     = t.gerencia;
    document.getElementById('regEstado').value       = t.estado_laboral;
    document.getElementById('regCiudad').value       = t.ciudad_trabajo;
    document.getElementById('regDireccion').value    = t.direccion_vivienda;
    document.getElementById('regCondVivienda').value    = t.condicion_vivienda;
    document.getElementById('regCondHabitantes').value  = t.condicion_habitantes;
    document.getElementById('regFallecidos').checked = !!t.hubo_fallecidos;
    document.getElementById('regHeridos').checked    = !!t.hubo_heridos;
    document.getElementById('regObservaciones').value = t.observaciones || '';

    const esCaracas = t.estado_laboral.includes('Caracas') || t.estado_laboral.includes('Distrito Capital');
    document.getElementById('torraWrap').style.display = esCaracas ? 'block' : 'none';
    if (t.torre_trabajo) document.getElementById('regTorre').value = t.torre_trabajo;

    abrirModal('modalRegistro');
  } catch (err) {
    toast('error', 'Error', 'No se pudo cargar el registro: ' + err.message);
  }
}

async function guardarRegistro() {
  const form = document.getElementById('formRegistro');
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const btn = document.getElementById('btnGuardar');
  setLoading(btn, true);

  const esCaracas = document.getElementById('regEstado').value.includes('Caracas') ||
                    document.getElementById('regEstado').value.includes('Distrito Capital');

  const datos = {
    nombres:              document.getElementById('regNombres').value.trim(),
    apellidos:            document.getElementById('regApellidos').value.trim(),
    cedula:               document.getElementById('regCedula').value.trim().toUpperCase(),
    fecha_nacimiento:     document.getElementById('regFechaNac').value,
    cargo:                document.getElementById('regCargo').value.trim(),
    gerencia:             document.getElementById('regGerencia').value.trim(),
    estado_laboral:       document.getElementById('regEstado').value,
    ciudad_trabajo:       document.getElementById('regCiudad').value.trim(),
    torre_trabajo:        esCaracas ? document.getElementById('regTorre').value : null,
    direccion_vivienda:   document.getElementById('regDireccion').value.trim(),
    condicion_vivienda:   document.getElementById('regCondVivienda').value.trim(),
    condicion_habitantes: document.getElementById('regCondHabitantes').value.trim(),
    hubo_fallecidos:      document.getElementById('regFallecidos').checked ? 1 : 0,
    hubo_heridos:         document.getElementById('regHeridos').checked    ? 1 : 0,
    observaciones:        document.getElementById('regObservaciones').value.trim(),
    usuario_id:           currentUser.id
  };

  const isEdit   = !!editingId;
  const method   = isEdit ? 'PUT' : 'POST';
  const endpoint = isEdit ? `/trabajadores/${editingId}` : '/trabajadores';

  // ══ ESCRITURA EN BACKEND ══
  try {
    await apiFetch(endpoint, method, datos, API_NODE);
    toast('success', '✅ Guardado', `Registro ${isEdit ? 'actualizado' : 'creado'} correctamente.`);
  } catch (err) {
    toast('error', '❌ Error al guardar', err.message || 'Error desconocido');
    return;
  }
  
  setLoading(btn, false);

  cerrarModal('modalRegistro');
  if (document.getElementById('page-lista').classList.contains('active')) cargarLista();
  if (document.getElementById('page-dashboard').classList.contains('active')) cargarDashboard();
}

/* ═══════════════════════════════════════════════════════════════════
   VER DETALLE
   ═══════════════════════════════════════════════════════════════════ */
async function verDetalle(id) {
  const body = document.getElementById('modalDetalleBody');
  body.innerHTML = `<div class="loader-wrap"><div class="loader"></div></div>`;
  abrirModal('modalDetalle');

  try {
    const t = await apiFetch(`/trabajadores/${id}`);
    body.innerHTML = `
      <div class="profile-card">
        <div class="profile-name">${t.nombres} ${t.apellidos}</div>
        <div class="profile-ci">Cédula: ${t.cedula} &nbsp;|&nbsp; Cargo: ${t.cargo}</div>
      </div>
      <div class="profile-grid">
        ${campo('📅 Fecha de Nacimiento', t.fecha_nacimiento)}
        ${campo('🏢 Gerencia', t.gerencia)}
        ${campo('🗺️ Estado Laboral', t.estado_laboral)}
        ${campo('🏙️ Ciudad de Trabajo', t.ciudad_trabajo)}
        ${campo('🏗️ Torre', t.torre_trabajo || '—')}
        ${campo('🏠 Dirección de Vivienda', t.direccion_vivienda)}
        ${campo('🏚️ Condición de Vivienda', t.condicion_vivienda)}
        ${campo('👨‍👩‍👧 Condición Habitantes', t.condicion_habitantes)}
        ${campo('⚰️ Fallecidos', t.hubo_fallecidos ? '⚠️ SÍ' : '✅ NO')}
        ${campo('🏥 Heridos', t.hubo_heridos ? '⚠️ SÍ' : '✅ NO')}
        ${t.observaciones ? campo('📝 Observaciones', t.observaciones) : ''}
        ${campo('📆 Registrado', formatFecha(t.creado_en))}
        ${t.modificado_en ? campo('✏️ Modificado', formatFecha(t.modificado_en)) : ''}
      </div>
    `;
  } catch (err) {
    body.innerHTML = `<div class="alert alert-danger">⚠️ ${err.message}</div>`;
  }
}

function campo(label, value) {
  return `
    <div class="profile-field">
      <div class="profile-field-label">${label}</div>
      <div class="profile-field-value">${value || '—'}</div>
    </div>
  `;
}

/* ═══════════════════════════════════════════════════════════════════
   ELIMINAR (BORRADO LÓGICO)
   ═══════════════════════════════════════════════════════════════════ */
function confirmarEliminar(id) {
  deleteId = id;
  abrirModal('modalConfirmar');
}

document.getElementById('btnConfirmarEliminar').addEventListener('click', async () => {
  if (!deleteId) return;
  const btn = document.getElementById('btnConfirmarEliminar');
  btn.disabled = true;
  btn.textContent = 'Procesando...';

  try {
    await apiFetch(`/trabajadores/${deleteId}`, 'DELETE', { usuario_id: currentUser.id }, API_NODE);
    toast('success', 'Registro desactivado', 'El trabajador fue desactivado correctamente.');
    cargarLista();
  } catch (err) {
    toast('error', 'Error', 'No se pudo desactivar el registro: ' + err.message);
  }

  btn.disabled = false;
  btn.textContent = 'Sí, desactivar';
  cerrarModal('modalConfirmar');
  deleteId = null;
});

/* ═══════════════════════════════════════════════════════════════════
   AUDITORÍA
   ═══════════════════════════════════════════════════════════════════ */
async function cargarAuditoria() {
  const body = document.getElementById('auditoriaBody');
  body.innerHTML = `<div class="loader-wrap"><div class="loader"></div></div>`;

  try {
    const rows = await apiFetch('/auditoria');
    if (!rows.length) {
      body.innerHTML = `<div class="empty-state"><div class="empty-icon">🔎</div><h3>Sin actividad registrada</h3></div>`;
      return;
    }
    body.innerHTML = rows.map(r => {
      const iconos = { INSERT:'➕', UPDATE:'✏️', DELETE:'🗑️', LOGIN:'🔐' };
      return `
        <div class="audit-item">
          <div class="audit-icon audit-${r.accion}">${iconos[r.accion] || '•'}</div>
          <div class="audit-content">
            <div class="audit-action"><span class="badge badge-gris">${r.accion}</span> — ${r.tabla}</div>
            <div class="audit-detail">${r.detalle || '—'} &nbsp;|&nbsp; Usuario: <strong>${r.username || 'Sistema'}</strong></div>
          </div>
          <div class="audit-date">${formatFecha(r.fecha)}</div>
        </div>
      `;
    }).join('');
  } catch (err) {
    body.innerHTML = `<div class="alert alert-danger">⚠️ ${err.message}</div>`;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   USUARIOS
   ═══════════════════════════════════════════════════════════════════ */
async function cargarUsuarios() {
  const tbody = document.getElementById('usuariosTableBody');
  tbody.innerHTML = `<tr><td colspan="6"><div class="loader-wrap"><div class="loader"></div></div></td></tr>`;

  try {
    const users = await apiFetch('/usuarios');
    const rolesLabel = { administrador:'🔴 Admin', atencion:'🟡 Atención', trabajador:'🟢 Trabajador' };
    const puedeReset = currentUser && ['administrador','atencion'].includes(currentUser.rol);
    const isAdmin = currentUser && currentUser.rol === 'administrador';
    
    // Filtrar para NO mostrar a los trabajadores en esta vista (solo usuarios de sistema)
    const systemUsers = users.filter(u => u.rol !== 'trabajador');

    tbody.innerHTML = systemUsers.map((u, i) => `
      <tr>
        <td style="color:var(--texto-muted)">${i+1}</td>
        <td><strong>${u.nombre} ${u.apellido}</strong></td>
        <td><code>${u.username}</code></td>
        <td>${rolesLabel[u.rol] || u.rol}</td>
        <td style="font-size:0.78rem;color:var(--texto-muted)">${formatFecha(u.creado_en)}</td>
        <td>
          ${isAdmin && u.username !== 'admin' ? `
          <button class="btn btn-danger btn-sm" style="padding:4px 8px; font-size:0.8rem; margin-left: 5px;" onclick="eliminarUsuario(${u.id}, '${u.nombre} ${u.apellido}')">
            🗑️ Eliminar
          </button>` : ''}
          ${!isAdmin ? '—' : ''}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="alert alert-danger">⚠️ ${err.message}</div></td></tr>`;
  }
}

document.getElementById('formNuevoUsuario').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('[type=submit]');
  setLoading(btn, true);

  const usernameVal = document.getElementById('nuUsername').value.trim();

  const datos = {
    nombre:   document.getElementById('nuNombre').value.trim(),
    apellido: document.getElementById('nuApellido').value.trim(),
    cedula:   `SYS-${usernameVal.toUpperCase()}`, // Dummy único
    username: usernameVal,
    password: document.getElementById('nuPassword').value,
    rol:      document.getElementById('nuRol').value
  };

  try {
    await apiFetch('/usuarios', 'POST', datos, API_NODE);
    toast('success', 'Usuario creado', `${datos.nombre} registrado correctamente.`);
    e.target.reset();
    cargarUsuarios();
  } catch (err) {
    toast('error', 'Error', err.message || 'No se pudo crear el usuario.');
  }
  setLoading(btn, false);
});

/* ═══════════════════════════════════════════════════════════════
   CAMBIAR / RESTABLECER CONTRASEÑA
   ═══════════════════════════════════════════════════════════════ */
function abrirModalCambiarPass() {
  document.getElementById('passActual').value = '';
  document.getElementById('passNueva').value = '';
  document.getElementById('passConfirmar').value = '';
  abrirModal('modalCambiarPass');
}

async function guardarNuevaPassword() {
  const actual     = document.getElementById('passActual').value;
  const nueva      = document.getElementById('passNueva').value;
  const confirmar  = document.getElementById('passConfirmar').value;

  if (!actual || !nueva || !confirmar) {
    toast('warning', 'Campos requeridos', 'Complete todos los campos.');
    return;
  }
  if (nueva !== confirmar) {
    toast('error', 'Error', 'Las contraseñas nuevas no coinciden.');
    return;
  }
  if (nueva.length < 6) {
    toast('error', 'Error', 'La nueva contraseña debe tener al menos 6 caracteres.');
    return;
  }

  try {
    const resp = await fetchJSON(`${API_NODE}/cambiar-password`, 'POST', {
      usuario_id: currentUser.id,
      password_actual: actual,
      password_nueva: nueva
    });
    toast('success', 'Éxito', resp.message || 'Contraseña actualizada correctamente.');
    cerrarModal('modalCambiarPass');
  } catch (err) {
    toast('error', 'Error', err.message || 'No se pudo cambiar la contraseña.');
  }
}

async function resetearPassword(userId, nombreUsuario) {
  if (!confirm(`¿Desea restablecer la contraseña de ${nombreUsuario} a "inapymi"?`)) return;
  try {
    const resp = await fetchJSON(`${API_NODE}/usuarios/${userId}/resetear`, 'POST', {
      usuario_id: currentUser.id
    });
    toast('success', 'Contraseña restablecida', resp.message);
  } catch (err) {
    toast('error', 'Error', err.message || 'No se pudo restablecer la contraseña.');
  }
}

/* ═══════════════════════════════════════════════════════════════════
   PERFIL TRABAJADOR
   ═══════════════════════════════════════════════════════════════════ */
async function cargarPerfil() {
  const cont = document.getElementById('perfilContent');
  cont.innerHTML = `<div class="loader-wrap"><div class="loader"></div></div>`;

  try {
    // Buscar por cédula del usuario logueado
    const lista = await apiFetch(`/trabajadores?cedula=${encodeURIComponent(currentUser.cedula || '')}`);
    if (!lista.length) {
      cont.innerHTML = `
        <div class="card">
          <div class="card-body">
            <div class="empty-state">
              <div class="empty-icon">🔍</div>
              <h3>No se encontró su registro</h3>
              <p>Comuníquese con Atención al Ciudadano para que registren su información.</p>
            </div>
          </div>
        </div>
      `;
      return;
    }
    const t = lista[0];
    cont.innerHTML = `
      <div class="profile-card">
        <div class="profile-name">${t.nombres} ${t.apellidos}</div>
        <div class="profile-ci">Cédula: ${t.cedula} &nbsp;|&nbsp; Cargo: ${t.cargo}</div>
      </div>
      <div class="profile-grid">
        ${campo('📅 Fecha de Nacimiento', t.fecha_nacimiento)}
        ${campo('🏢 Gerencia', t.gerencia)}
        ${campo('🗺️ Estado Laboral', t.estado_laboral)}
        ${campo('🏙️ Ciudad de Trabajo', t.ciudad_trabajo)}
        ${t.torre_trabajo ? campo('🏗️ Torre', t.torre_trabajo) : ''}
        ${campo('🏠 Dirección de Vivienda', t.direccion_vivienda)}
        ${campo('🏚️ Condición de Vivienda', t.condicion_vivienda)}
        ${campo('👨‍👩‍👧 Condición Habitantes', t.condicion_habitantes)}
        ${campo('⚰️ Fallecidos', t.hubo_fallecidos ? '⚠️ SÍ - Se registró fallecido(s)' : '✅ NO')}
        ${campo('🏥 Heridos', t.hubo_heridos ? '⚠️ SÍ - Se registró herido(s)' : '✅ NO')}
        ${t.observaciones ? campo('📝 Observaciones', t.observaciones) : ''}
        ${campo('📆 Fecha de Registro', formatFecha(t.creado_en))}
      </div>
    `;
  } catch (err) {
    cont.innerHTML = `<div class="alert alert-danger">⚠️ ${err.message}</div>`;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   HELPERS: MODALES
   ═══════════════════════════════════════════════════════════════════ */
function abrirModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function cerrarModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

// Cerrar modal al clickear el overlay
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cerrarModal(overlay.id);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   HELPERS: HTTP
   ═══════════════════════════════════════════════════════════════════ */
async function apiFetch(endpoint, method = 'GET', body = null, base = null) {
  // Siempre intentar Node (no bloquear por nodeOnline; si falla la red, se lanza el error real)
  if (!base) base = API_NODE;

  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(8000)
  };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);

  const res = await fetch(`${base}${endpoint}`, opts);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.error || `Error HTTP ${res.status}`);
  return data;
}

async function fetchJSON(url, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(5000)
  };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error de servidor');
  return data;
}

/* ═══════════════════════════════════════════════════════════════════
   CAMBIAR / RESTABLECER CONTRASEÑA
   ═══════════════════════════════════════════════════════════════════ */
function abrirModalCambiarPass() {
  document.getElementById('passActual').value = '';
  document.getElementById('passNueva').value = '';
  document.getElementById('passConfirmar').value = '';
  abrirModal('modalCambiarPass');
}

async function guardarNuevaPassword() {
  const actual     = document.getElementById('passActual').value;
  const nueva      = document.getElementById('passNueva').value;
  const confirmar  = document.getElementById('passConfirmar').value;

  if (!actual || !nueva || !confirmar) {
    toast('warning', 'Campos requeridos', 'Complete todos los campos.');
    return;
  }
  if (nueva !== confirmar) {
    toast('error', 'Error', 'Las contraseñas nuevas no coinciden.');
    return;
  }
  if (nueva.length < 6) {
    toast('error', 'Error', 'La nueva contraseña debe tener al menos 6 caracteres.');
    return;
  }

  try {
    const resp = await fetchJSON(`${API_NODE}/cambiar-password`, 'POST', {
      usuario_id: currentUser.id,
      password_actual: actual,
      password_nueva: nueva
    });
    toast('success', 'Éxito', resp.message || 'Contraseña actualizada correctamente.');
    cerrarModal('modalCambiarPass');
  } catch (err) {
    toast('error', 'Error', err.message || 'No se pudo cambiar la contraseña.');
  }
}

async function resetearPassword(userId, nombreUsuario) {
  if (!confirm(`¿Desea restablecer la contraseña de ${nombreUsuario} a "inapymi"?`)) return;
  try {
    const resp = await fetchJSON(`${API_NODE}/usuarios/${userId}/resetear`, 'POST', {
      usuario_id: currentUser.id
    });
    toast('success', 'Contraseña restablecida', resp.message);
  } catch (err) {
    toast('error', 'Error', err.message || 'No se pudo restablecer la contraseña.');
  }
}

async function eliminarUsuario(userId, nombreUsuario) {
  if (!confirm(`⚠️ ¿ESTÁ SEGURO?\n\nVa a eliminar por completo el acceso del usuario: ${nombreUsuario}.\nEsta acción no se puede deshacer.`)) return;
  try {
    const resp = await fetchJSON(`${API_NODE}/usuarios/${userId}`, 'DELETE');
    toast('success', 'Usuario eliminado', resp.message);
    cargarUsuarios(); // Recargar tabla
  } catch (err) {
    toast('error', 'Error', err.message || 'No se pudo eliminar al usuario.');
  }
}

/* ═══════════════════════════════════════════════════════════════════
   HELPERS: UI
   ═══════════════════════════════════════════════════════════════════ */
function setLoading(btn, loading) {
  btn.classList.toggle('loading', loading);
  btn.disabled = loading;
}

function toast(type, title, msg) {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  el.className = `toast ${type}`;
  el.innerHTML = `
    <div class="toast-icon">${icons[type] || 'ℹ️'}</div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${msg}</div>
    </div>
  `;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('toast-out');
    el.addEventListener('animationend', () => el.remove());
  }, 4500);
}

function formatFecha(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString('es-VE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }).replace(',','');
}

function truncar(str, n) {
  if (!str) return '—';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* ═══════════════════════════════════════════════════════════════════
   PERFIL DEL TRABAJADOR
   ═══════════════════════════════════════════════════════════════════ */
async function cargarPerfil() {
  const container = document.getElementById('perfilContent');
  const banner    = document.getElementById('certStatusBanner');
  if (!container) return;
  container.innerHTML = `<div class="loader-wrap"><div class="loader"></div></div>`;
  if (banner) banner.style.display = 'none';

  try {
    const list = await apiFetch(`/trabajadores`);
    const username = currentUser.username;
    let t = list.find(x => x.cedula === username);

    if (!t) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>No se encontraron sus datos</h3>
          <p>Usted está registrado como trabajador, pero aún no se ha ingresado su formulario en el sistema. Comuníquese con Atención al Ciudadano.</p>
        </div>`;
      return;
    }

    // ── Banner prominente de certificación ──────────────────────────
    if (banner) {
      banner.style.display = 'block';
      if (t.cert_estado === 'pendiente' || !t.cert_estado) {
        banner.innerHTML = `
          <div style="background:linear-gradient(135deg,#1e3a5f,#1d4ed8);border-radius:16px;padding:28px 32px;color:white;display:flex;align-items:center;gap:24px;box-shadow:0 8px 32px rgba(29,78,216,0.3)">
            <div style="font-size:3rem;flex-shrink:0">🔍</div>
            <div>
              <div style="font-size:1.1rem;font-weight:700;margin-bottom:6px;">Estado del Certificado: <span style="color:#fbbf24">PENDIENTE DE EVALUACIÓN</span></div>
              <div style="font-size:0.9rem;opacity:0.85;line-height:1.5;">Su información registrada se encuentra actualmente <strong>en espera de revisión</strong> por parte del personal de INAPYMI. Una vez que los funcionarios competentes realicen las inspecciones de rigor, se le notificará aquí y se emitirá su certificado de veracidad.</div>
            </div>
          </div>`;
      } else if (t.cert_estado === 'en_revision') {
        banner.innerHTML = `
          <div style="background:linear-gradient(135deg,#78350f,#d97706);border-radius:16px;padding:28px 32px;color:white;display:flex;align-items:center;gap:24px;box-shadow:0 8px 32px rgba(217,119,6,0.35)">
            <div style="font-size:3rem;flex-shrink:0;animation:spin 2s linear infinite">⏳</div>
            <div>
              <div style="font-size:1.1rem;font-weight:700;margin-bottom:6px;">Estado del Certificado: <span style="color:#fef08a">EN REVISIÓN</span></div>
              <div style="font-size:0.9rem;opacity:0.9;line-height:1.5;">Su expediente está siendo <strong>analizado minuciosamente</strong> por el funcionario <strong>${t.cert_nombre_revisor || 'del equipo de Atención al Ciudadano'}</strong>. Una vez concluidas las inspecciones de rigor, se emitirá el certificado que avala la veracidad de la información contentiva en el registro.</div>
            </div>
          </div>`;
      } else if (t.cert_estado === 'certificado') {
        banner.innerHTML = `
          <div style="background:linear-gradient(135deg,#14532d,#16a34a);border-radius:16px;padding:28px 32px;color:white;display:flex;align-items:center;gap:24px;box-shadow:0 8px 32px rgba(22,163,74,0.35)">
            <div style="font-size:3rem;flex-shrink:0">✅</div>
            <div style="flex:1">
              <div style="font-size:1.1rem;font-weight:700;margin-bottom:6px;">Estado del Certificado: <span style="color:#bbf7d0">CERTIFICADO Y VERIFICADO</span></div>
              <div style="font-size:0.9rem;opacity:0.9;line-height:1.5;margin-bottom:14px;">Su información ha sido <strong>certificada oficialmente</strong> por ${t.cert_nombre_revisor || 'INAPYMI'} tras las inspecciones pertinentes. El certificado de veracidad está disponible para su descarga.</div>
              <button onclick="abrirCertificado(${t.id})" style="background:white;color:#14532d;border:none;padding:10px 24px;border-radius:8px;font-weight:700;font-size:0.9rem;cursor:pointer;display:inline-flex;align-items:center;gap:8px;">
                📄 Ver &amp; Descargar Certificado PDF
              </button>
            </div>
          </div>`;
      }
    }

    // ── Tarjeta de datos del trabajador ─────────────────────────────
    container.innerHTML = `
      <div class="profile-card" style="margin-bottom:20px;">
        <div class="profile-name">${t.nombres} ${t.apellidos}</div>
        <div class="profile-ci">Cédula: ${t.cedula} &nbsp;|&nbsp; Cargo: ${t.cargo} &nbsp;|&nbsp; Gerencia: ${t.gerencia}</div>
      </div>
      <div class="profile-grid">
        ${campo('📅 Fecha de Nacimiento', formatFecha(t.fecha_nacimiento).split(' ')[0])}
        ${campo('🗺️ Estado Laboral', t.estado_laboral)}
        ${campo('🏙️ Ciudad de Trabajo', t.ciudad_trabajo)}
        ${t.torre_trabajo ? campo('🏗️ Torre', t.torre_trabajo) : ''}
        ${campo('🏠 Dirección Vivienda', t.direccion_vivienda)}
        ${campo('🏚️ Condición Vivienda', t.condicion_vivienda)}
        ${campo('👨‍👩‍👧 Condición Habitantes', t.condicion_habitantes)}
        ${campo('⚰️ ¿Hubo Fallecidos?', t.hubo_fallecidos ? '⚠️ Sí' : '✅ No')}
        ${campo('🏥 ¿Hubo Heridos?', t.hubo_heridos ? '⚠️ Sí' : '✅ No')}
        ${t.observaciones ? campo('📝 Observaciones', t.observaciones) : ''}
      </div>
    `;

  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger">⚠️ ${err.message}</div>`;
  }
}

