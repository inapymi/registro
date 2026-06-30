/**
 * INAPYMI – Backend Node.js (SIN dependencias externas)
 * Usa módulos nativos: node:http, node:sqlite
 * Puerto: 3001
 */

const http   = require('node:http');
const path   = require('node:path');
const fs     = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const FRONTEND = path.join(__dirname, '..', 'frontend');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon'
};

function serveStatic(req, res) {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(FRONTEND, urlPath);
  if (!filePath.startsWith(FRONTEND)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const PORT    = 3001;
const DB_PATH = path.join(__dirname, 'inapymi_node.sqlite');
const db      = new DatabaseSync(DB_PATH);

// ── Inicializar BD ──────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT    NOT NULL UNIQUE,
    password    TEXT    NOT NULL,
    rol         TEXT    NOT NULL,
    nombre      TEXT    NOT NULL,
    apellido    TEXT    NOT NULL,
    cedula      TEXT    NOT NULL UNIQUE,
    creado_en   TEXT    DEFAULT (datetime('now','localtime')),
    activo      INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS trabajadores (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    nombres                 TEXT    NOT NULL,
    apellidos               TEXT    NOT NULL,
    cedula                  TEXT    NOT NULL UNIQUE,
    fecha_nacimiento        TEXT    NOT NULL,
    cargo                   TEXT    NOT NULL,
    gerencia                TEXT    NOT NULL,
    estado_laboral          TEXT    NOT NULL,
    ciudad_trabajo          TEXT    NOT NULL,
    torre_trabajo           TEXT,
    direccion_vivienda      TEXT    NOT NULL,
    condicion_vivienda      TEXT    NOT NULL,
    condicion_habitantes    TEXT    NOT NULL,
    hubo_fallecidos         INTEGER NOT NULL DEFAULT 0,
    hubo_heridos            INTEGER NOT NULL DEFAULT 0,
    observaciones           TEXT,
    creado_por              INTEGER,
    creado_en               TEXT    DEFAULT (datetime('now','localtime')),
    modificado_por          INTEGER,
    modificado_en           TEXT,
    activo                  INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS auditoria (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    tabla         TEXT NOT NULL,
    accion        TEXT NOT NULL,
    registro_id   INTEGER,
    usuario_id    INTEGER,
    detalle       TEXT,
    fecha         TEXT DEFAULT (datetime('now','localtime'))
  );
`);

// Usuarios por defecto (personal administrativo)
db.exec(`
  INSERT OR IGNORE INTO usuarios (username,password,rol,nombre,apellido,cedula) VALUES
    ('admin','Inapymi2001','administrador','Administrador','Sistema','V-00000001'),
    ('atencion1','Atencion2024','atencion','Operador','Ciudadano','V-00000002');
`);

// ── Helpers ─────────────────────────────────────────────────────────────────
function auditar(tabla, accion, registroId, usuarioId, detalle) {
  db.prepare(
    'INSERT INTO auditoria (tabla,accion,registro_id,usuario_id,detalle) VALUES (?,?,?,?,?)'
  ).run(tabla, accion, registroId, usuarioId, detalle);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { resolve({}); }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type':  'application/json; charset=utf-8',
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(json);
}

function urlParts(url) {
  const [pathname, search] = url.split('?');
  const parts = pathname.replace(/\/$/, '').split('/').filter(Boolean);
  const params = {};
  if (search) search.split('&').forEach(p => {
    const [k, v] = p.split('=');
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
  });
  return { parts, params };
}

// ── Servidor HTTP ─────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  const { parts, params } = urlParts(req.url);
  const resource = parts[1];
  const id       = parts[2];
  const subaction = parts[3]; // e.g. /api/usuarios/5/resetear
  const method   = req.method;

  try {
    // ── /api/health ──────────────────────────────────────────────────
    if (resource === 'health') {
      return send(res, 200, { status: 'ok', backend: 'Node.js nativo', timestamp: new Date().toISOString() });
    }

    // ── /api/login ───────────────────────────────────────────────────
    // Acepta: (1) username+password de usuarios administrativos
    //         (2) cedula+password para trabajadores registrados
    if (resource === 'login' && method === 'POST') {
      const { username, password } = await parseBody(req);
      if (!username || !password) return send(res, 400, { error: 'Usuario y contraseña requeridos.' });

      // Intentar login por username normal
      let user = db.prepare(
        'SELECT id,username,rol,nombre,apellido FROM usuarios WHERE username=? AND password=? AND activo=1'
      ).get(username, password);

      // Si no encontró por username, intentar por cédula (trabajadores registrados)
      if (!user) {
        user = db.prepare(
          'SELECT id,username,rol,nombre,apellido FROM usuarios WHERE cedula=? AND password=? AND activo=1'
        ).get(username, password);
      }

      if (!user) return send(res, 401, { error: 'Credenciales inválidas.' });
      auditar('usuarios','LOGIN', user.id, user.id, `Inicio sesión: ${user.username}`);
      return send(res, 200, { success: true, user });
    }

    // ── /api/cambiar-password ────────────────────────────────────────
    // El propio usuario cambia su contraseña
    if (resource === 'cambiar-password' && method === 'POST') {
      const { usuario_id, password_actual, password_nueva } = await parseBody(req);
      if (!usuario_id || !password_actual || !password_nueva)
        return send(res, 400, { error: 'Datos incompletos.' });
      if (password_nueva.length < 6)
        return send(res, 400, { error: 'La nueva contraseña debe tener al menos 6 caracteres.' });

      const user = db.prepare('SELECT id FROM usuarios WHERE id=? AND password=? AND activo=1')
        .get(usuario_id, password_actual);
      if (!user) return send(res, 401, { error: 'La contraseña actual es incorrecta.' });

      db.prepare('UPDATE usuarios SET password=? WHERE id=?').run(password_nueva, usuario_id);
      auditar('usuarios', 'CAMBIO_PASSWORD', usuario_id, usuario_id, 'Cambio de contraseña propio');
      return send(res, 200, { message: 'Contraseña actualizada correctamente.' });
    }

    // ── /api/trabajadores ────────────────────────────────────────────
    if (resource === 'trabajadores') {
      if (method === 'GET' && !id) {
        let sql = 'SELECT * FROM trabajadores WHERE activo=1';
        const p = [];
        if (params.cedula) { sql += ' AND cedula=?'; p.push(params.cedula); }
        else {
          if (params.buscar) { sql += ' AND (nombres LIKE ? OR apellidos LIKE ? OR cedula LIKE ?)'; const b=`%${params.buscar}%`; p.push(b,b,b); }
          if (params.estado) { sql += ' AND estado_laboral=?'; p.push(params.estado); }
        }
        sql += ' ORDER BY creado_en DESC';
        return send(res, 200, db.prepare(sql).all(...p));
      }
      if (method === 'GET' && id) {
        const t = db.prepare('SELECT * FROM trabajadores WHERE id=? AND activo=1').get(id);
        return t ? send(res, 200, t) : send(res, 404, { error: 'No encontrado.' });
      }
      if (method === 'POST') {
        const d = await parseBody(req);
        try {
          const info = db.prepare(`
            INSERT INTO trabajadores
              (nombres,apellidos,cedula,fecha_nacimiento,cargo,gerencia,
               estado_laboral,ciudad_trabajo,torre_trabajo,
               direccion_vivienda,condicion_vivienda,condicion_habitantes,
               hubo_fallecidos,hubo_heridos,observaciones,creado_por)
            VALUES
              (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          `).run(
            d.nombres,d.apellidos,d.cedula,d.fecha_nacimiento,d.cargo,d.gerencia,
            d.estado_laboral,d.ciudad_trabajo,d.torre_trabajo||null,
            d.direccion_vivienda,d.condicion_vivienda,d.condicion_habitantes,
            d.hubo_fallecidos?1:0,d.hubo_heridos?1:0,d.observaciones||null,d.usuario_id||null
          );
          const newId = info.lastInsertRowid;
          auditar('trabajadores','INSERT',newId,d.usuario_id,`Nuevo: ${d.nombres} ${d.apellidos} ${d.cedula}`);

          // ── Auto-crear cuenta de acceso para el trabajador ──────────
          // username = cedula, password = 'inapymi' (contraseña por defecto)
          try {
            db.prepare(
              'INSERT OR IGNORE INTO usuarios (username,password,rol,nombre,apellido,cedula) VALUES (?,?,?,?,?,?)'
            ).run(d.cedula, 'inapymi', 'trabajador', d.nombres, d.apellidos, d.cedula);
          } catch(e) { /* si ya existe, no hacer nada */ }

          return send(res, 201, { id: newId, message: 'Trabajador registrado.' });
        } catch(e) {
          if (e.message.includes('UNIQUE')) return send(res, 409, { error: `Ya existe un trabajador con la cédula ${d.cedula}.` });
          return send(res, 500, { error: e.message });
        }
      }
      if (method === 'PUT' && id) {
        const d = await parseBody(req);
        try {
          const info = db.prepare(`
            UPDATE trabajadores SET
              nombres=?,apellidos=?,cedula=?,fecha_nacimiento=?,cargo=?,gerencia=?,
              estado_laboral=?,ciudad_trabajo=?,torre_trabajo=?,
              direccion_vivienda=?,condicion_vivienda=?,condicion_habitantes=?,
              hubo_fallecidos=?,hubo_heridos=?,observaciones=?,
              modificado_por=?,modificado_en=datetime('now','localtime')
            WHERE id=? AND activo=1
          `).run(
            d.nombres,d.apellidos,d.cedula,d.fecha_nacimiento,d.cargo,d.gerencia,
            d.estado_laboral,d.ciudad_trabajo,d.torre_trabajo||null,
            d.direccion_vivienda,d.condicion_vivienda,d.condicion_habitantes,
            d.hubo_fallecidos?1:0,d.hubo_heridos?1:0,d.observaciones||null,
            d.usuario_id||null, id
          );
          if (info.changes===0) return send(res,404,{error:'No encontrado.'});
          auditar('trabajadores','UPDATE',id,d.usuario_id,`Actualizado: ${d.nombres} ${d.apellidos}`);
          return send(res, 200, { message: 'Trabajador actualizado.' });
        } catch(e) { return send(res,500,{error:e.message}); }
      }
      if (method === 'DELETE' && id) {
        const d = await parseBody(req);
        const info = db.prepare(
          "UPDATE trabajadores SET activo=0,modificado_por=?,modificado_en=datetime('now','localtime') WHERE id=? AND activo=1"
        ).run(d.usuario_id||null, id);
        if (info.changes===0) return send(res,404,{error:'No encontrado.'});
        auditar('trabajadores','DELETE',id,d.usuario_id,`Desactivado ID:${id}`);
        return send(res, 200, { message: 'Registro desactivado.' });
      }
    }

    // ── /api/estadisticas ────────────────────────────────────────────
    if (resource === 'estadisticas' && method === 'GET') {
      const total      = db.prepare('SELECT COUNT(*) as n FROM trabajadores WHERE activo=1').get().n;
      const fallecidos = db.prepare('SELECT COUNT(*) as n FROM trabajadores WHERE activo=1 AND hubo_fallecidos=1').get().n;
      const heridos    = db.prepare('SELECT COUNT(*) as n FROM trabajadores WHERE activo=1 AND hubo_heridos=1').get().n;
      const porEstado  = db.prepare('SELECT estado_laboral, COUNT(*) as total FROM trabajadores WHERE activo=1 GROUP BY estado_laboral').all();
      return send(res, 200, { total, fallecidos, heridos, porEstado });
    }

    // ── /api/auditoria ───────────────────────────────────────────────
    if (resource === 'auditoria' && method === 'GET') {
      const rows = db.prepare(`
        SELECT a.*, u.username, u.nombre, u.apellido
        FROM auditoria a LEFT JOIN usuarios u ON a.usuario_id=u.id
        ORDER BY a.fecha DESC LIMIT 500
      `).all();
      return send(res, 200, rows);
    }

    // ── /api/usuarios ────────────────────────────────────────────────
    if (resource === 'usuarios') {
      if (method === 'GET') {
        return send(res, 200, db.prepare('SELECT id,username,rol,nombre,apellido,cedula,creado_en,activo FROM usuarios').all());
      }
      if (method === 'POST') {
        const d = await parseBody(req);
        try {
          const info = db.prepare(
            'INSERT INTO usuarios (username,password,rol,nombre,apellido,cedula) VALUES (?,?,?,?,?,?)'
          ).run(d.username,d.password,d.rol,d.nombre,d.apellido,d.cedula);
          return send(res, 201, { id: info.lastInsertRowid, message: 'Usuario creado.' });
        } catch(e) { return send(res,409,{error:'Usuario o cédula ya existe.'}); }
      }

      // ── /api/usuarios/:id/resetear  (admin o atencion resetean password) ──
      if (id && subaction === 'resetear' && method === 'POST') {
        const d = await parseBody(req);
        // Solo admin o atencion pueden resetear
        const solicitante = db.prepare('SELECT rol FROM usuarios WHERE id=? AND activo=1').get(d.usuario_id);
        if (!solicitante || !['administrador','atencion'].includes(solicitante.rol))
          return send(res, 403, { error: 'No tiene permisos para esta acción.' });

        const target = db.prepare('SELECT id,nombre,apellido FROM usuarios WHERE id=? AND activo=1').get(id);
        if (!target) return send(res, 404, { error: 'Usuario no encontrado.' });

        db.prepare("UPDATE usuarios SET password='inapymi' WHERE id=?").run(id);
        auditar('usuarios','RESET_PASSWORD', id, d.usuario_id,
          `Contraseña restablecida a default para usuario ID:${id} (${target.nombre} ${target.apellido})`);
        return send(res, 200, { message: `Contraseña restablecida a "inapymi" correctamente.` });
      }
    }

    // Si no es una ruta de API, servir el frontend estático
    return serveStatic(req, res);

  } catch (err) {
    console.error(err);
    send(res, 500, { error: 'Error interno del servidor.' });
  }
});

server.listen(PORT, () => {
  console.log(`✅  Backend Node.js (nativo) corriendo en http://localhost:${PORT}`);
  console.log(`    Sin dependencias externas – Node.js v${process.versions.node}`);
});
