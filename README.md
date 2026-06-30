# INAPYMI - Sistema de Registro Post-Sismo
# README del proyecto

## ¿Cómo iniciar el sistema?

### Opción 1 (Recomendada): Script automático
1. Haga clic derecho sobre `INICIAR_SISTEMA.ps1`
2. Seleccione **"Ejecutar con PowerShell"**
3. El script verificará las dependencias, iniciará ambos backends y abrirá el navegador automáticamente.

---

### Opción 2: Inicio manual

#### Backend Node.js (Puerto 3001)
```powershell
cd node_backend
npm install       # Solo la primera vez
node server.js
```

#### Backend PHP (Puerto 8080)
```powershell
cd php_backend
php -S localhost:8080 api.php
```

#### Frontend
Abra el archivo `frontend/index.html` directamente en su navegador.

---

## Credenciales de acceso

| Usuario       | Contraseña     | Rol                    | Permisos                        |
|---------------|----------------|------------------------|---------------------------------|
| `admin`       | `Inapymi2001`  | Administrador          | Todo: CRUD + Auditoría + Usuarios |
| `atencion1`   | `Atencion2024` | Atención al Ciudadano  | Crear, modificar, ver registros |
| `trabajador1` | `Trabajador2024` | Trabajador           | Solo ver su propia información  |

---

## Estructura del proyecto

```
Inapymi/
├── INICIAR_SISTEMA.ps1         ← Script de inicio automático
├── README.md                   ← Este archivo
│
├── frontend/                   ← Interfaz web (HTML + CSS + JS)
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
│
├── node_backend/               ← API REST Node.js (Puerto 3001)
│   ├── server.js
│   ├── package.json
│   └── inapymi_node.sqlite     ← Base de datos (se crea automáticamente)
│
└── php_backend/                ← API REST PHP (Puerto 8080)
    ├── api.php
    └── inapymi_php.sqlite      ← Base de datos (se crea automáticamente)
```

---

## Campos del registro de trabajadores

- **Nombres y Apellidos**
- **Número de Cédula** (único)
- **Fecha de Nacimiento**
- **Cargo**
- **Gerencia**
- **Estado del país donde labora** (los 24 estados de Venezuela)
- **Ciudad donde trabaja**
- **Torre de trabajo** (solo para Caracas/Distrito Capital)
- **Dirección de casa o apartamento**
- **Condiciones de la vivienda**
- **Condiciones de los habitantes**
- **¿Hubo fallecidos a causa del sismo?**
- **¿Hubo heridos?**
- **Observaciones adicionales**

---

## Arquitectura técnica

El sistema escribe **simultáneamente** en dos bases de datos independientes:
- **Node.js backend** → `inapymi_node.sqlite` (vía Express + better-sqlite3)
- **PHP backend** → `inapymi_php.sqlite` (vía PHP PDO + SQLite)

Si uno de los backends no está disponible, el sistema notifica al usuario pero continúa funcionando con el backend disponible.
