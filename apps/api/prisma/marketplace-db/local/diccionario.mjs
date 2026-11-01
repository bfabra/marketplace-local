// Genera el diccionario de datos leyendo la base real (PostgreSQL local):
//   docs/MODELO_DATOS.md   documento con módulos, tablas, campos, reglas y diagramas
//   docs/modelo_datos.csv  una fila por campo, para Excel
//
//   node local/diccionario.mjs     (desde apps/api: npm run db:docs)
//
// Las descripciones salen, en este orden, de los comentarios de la base, de los
// comentarios de las migraciones SQL y de DESCRIPCIONES / CAMPOS_COMUNES (abajo).
// Al agregar un campo nuevo, lo ideal es documentarlo con un comentario en su migración.

import pg from 'pg';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const archivoEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
const carpetaDocs = fileURLToPath(new URL('../../../../../docs/', import.meta.url));

if (!process.env.DATABASE_URL && existsSync(archivoEnv)) process.loadEnvFile(archivoEnv);
if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL (en apps/api/.env).');
  process.exit(1);
}
const url = new URL(process.env.DATABASE_URL);
url.search = '';

// ---------------------------------------------------------------------------
// 1. Lo que dicen las migraciones: módulo de cada tabla y comentarios
// ---------------------------------------------------------------------------
function leerMigraciones() {
  const dir = raiz + 'supabase/migrations/';
  const modulos = [];
  const tablas = {};
  const enumValores = {};
  const separador = /^--\s*[-=]{5,}\s*$/;

  for (const archivo of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const lineas = readFileSync(dir + archivo, 'utf8').split(/\r?\n/);
    const titulo = lineas.map((l) => l.match(/^--\s*(MÓDULO\s+\d+\s*·\s*.+)$/i)?.[1]).find(Boolean);
    let modulo = null;
    let buffer = [];
    let bloque = null;
    let pendiente = [];

    for (const linea of lineas) {
      const t = linea.trim();

      if (bloque) {
        if (/^\);?/.test(t)) {
          bloque = null;
          continue;
        }
        const cierraEnum = bloque.tipo === 'enum' && t.includes(');');
        if (t.startsWith('--')) {
          pendiente.push(t.replace(/^--\s*/, ''));
          continue;
        }
        if (bloque.tipo === 'tabla') {
          const m = linea.match(/^\s+([a-z_][a-z0-9_]*)\s+[^-]*?(?:--\s*(.+))?$/);
          if (m && !/^(unique|primary|foreign|check|constraint|exclude)$/.test(m[1])) {
            const nota = [...pendiente, m[2]].filter(Boolean).join(' ');
            if (nota) tablas[bloque.nombre].columnas[m[1]] = nota;
          }
        } else {
          for (const v of linea.matchAll(/'([^']+)'/g)) {
            const nota = linea.match(/--\s*(.+)$/)?.[1];
            if (nota) enumValores[bloque.nombre][v[1]] = nota;
          }
        }
        pendiente = [];
        if (cierraEnum) bloque = null;
        continue;
      }

      const tabla = t.match(/^create table (?:if not exists )?public\.([a-z_0-9]+)/i);
      const tipoEnum = t.match(/^create type public\.([a-z_0-9]+) as enum/i);
      if (tabla) {
        if (!modulo) {
          modulo = { titulo: titulo?.replace(/^MÓDULO/i, 'Módulo') ?? archivo, archivo, tablas: [] };
          modulos.push(modulo);
        }
        modulo.tablas.push(tabla[1]);
        tablas[tabla[1]] = { modulo: modulo.titulo, descripcion: buffer.join(' '), columnas: {} };
        buffer = [];
        if (!t.endsWith(');')) bloque = { tipo: 'tabla', nombre: tabla[1] };
      } else if (tipoEnum) {
        enumValores[tipoEnum[1]] = {};
        if (!t.endsWith(');')) bloque = { tipo: 'enum', nombre: tipoEnum[1] };
        buffer = [];
      } else if (t.startsWith('--')) {
        if (!separador.test(t) && !/^--\s*(MÓDULO|Tablas:)/i.test(t) && !/^--\s{3,}/.test(linea)) {
          buffer.push(t.replace(/^--\s*/, ''));
        }
      } else if (t !== '') {
        buffer = [];
      }
    }
  }
  return { modulos, tablas, enumValores };
}

// ---------------------------------------------------------------------------
// 2. Lo que dice la base
// ---------------------------------------------------------------------------
async function leerBase(db, esquema) {
  const q = async (sql, params) => (await db.query(sql, params)).rows;

  const tablas = await q(
    `select c.oid, c.relname as nombre, obj_description(c.oid, 'pg_class') as comentario,
            c.relrowsecurity as rls
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = $1 and c.relkind in ('r', 'p')
      order by c.relname`,
    [esquema]
  );
  const oids = tablas.map((t) => t.oid);

  const columnas = await q(
      `select a.attrelid as oid, a.attnum, a.attname as nombre,
              format_type(a.atttypid, a.atttypmod) as tipo, t.typname, t.typtype, t.typcategory,
              a.attnotnull as no_nulo, pg_get_expr(d.adbin, d.adrelid) as defecto,
              col_description(a.attrelid, a.attnum) as comentario
         from pg_attribute a
         join pg_type t on t.oid = a.atttypid
         left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
        where a.attrelid = any($1) and a.attnum > 0 and not a.attisdropped
        order by a.attrelid, a.attnum`,
      [oids]
    );
  const restricciones = await q(
      `select k.conrelid as oid, k.conname as nombre, k.contype as tipo, k.conkey::int[] as columnas,
              k.confrelid::regclass::text as ref_tabla, k.confdeltype as al_borrar,
              (select array_agg(a.attname::text order by a.attnum) from pg_attribute a
                where a.attrelid = k.confrelid and a.attnum = any(k.confkey)) as ref_columnas,
              pg_get_constraintdef(k.oid) as definicion
         from pg_constraint k
        where k.conrelid = any($1)
        order by k.conname`,
      [oids]
    );
  const indices = await q(
      `select i.indrelid as oid, ic.relname as nombre, i.indisunique as unico,
              pg_get_indexdef(i.indexrelid) as definicion,
              exists (select 1 from pg_constraint k where k.conindid = i.indexrelid) as de_restriccion
         from pg_index i join pg_class ic on ic.oid = i.indexrelid
        where i.indrelid = any($1)
        order by ic.relname`,
      [oids]
    );
  const triggers = await q(
      `select tgrelid as oid, tgname as nombre, pg_get_triggerdef(oid) as definicion
         from pg_trigger where tgrelid = any($1) and not tgisinternal
        order by tgname`,
      [oids]
    );
  const politicas = await q(
      `select tablename as tabla, policyname as nombre, cmd as comando, roles::text[] as roles
         from pg_policies where schemaname = $1 order by tablename, policyname`,
      [esquema]
    );

  return { tablas, columnas, restricciones, indices, triggers, politicas };
}

async function leerEnums(db) {
  return (
    await db.query(
      `select t.typname as nombre, array_agg(e.enumlabel::text order by e.enumsortorder) as valores,
              obj_description(t.oid, 'pg_type') as comentario
         from pg_type t
         join pg_enum e on e.enumtypid = t.oid
         join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public'
        group by t.oid, t.typname
        order by t.typname`
    )
  ).rows;
}

// ---------------------------------------------------------------------------
// 3. Formato
// ---------------------------------------------------------------------------
const miles = (n) => n.toLocaleString('es-AR');
const md = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const AL_BORRAR = { a: 'sin acción', r: 'impide borrar', c: 'borra en cascada', n: 'pone NULL', d: 'pone el valor por defecto' };

function maximoNumeric(p, s) {
  const enteros = '9'.repeat(p - s).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return s > 0 ? `${enteros || '0'},${'9'.repeat(s)}` : enteros;
}

function describirTipo(col) {
  const t = col.tipo;
  if (col.typtype === 'e') return { tipo: `enum ${col.typname}`, largo: '4 bytes (lista cerrada de valores)' };
  if (col.typcategory === 'A') return { tipo: t, largo: 'Lista de largo variable' };
  let m;
  if ((m = t.match(/^character varying\((\d+)\)$/))) return { tipo: `varchar(${m[1]})`, largo: `Hasta ${m[1]} caracteres` };
  if ((m = t.match(/^character\((\d+)\)$/))) return { tipo: `char(${m[1]})`, largo: `Exactamente ${m[1]} caracteres` };
  if ((m = t.match(/^numeric\((\d+),(\d+)\)$/))) {
    const [p, s] = [Number(m[1]), Number(m[2])];
    return { tipo: t, largo: `${p} dígitos, ${s} decimales (máx. ${maximoNumeric(p, s)})` };
  }
  const fijos = {
    uuid: ['uuid', '16 bytes (36 caracteres en texto)'],
    text: ['text', 'Sin límite fijo'],
    'character varying': ['varchar', 'Sin límite fijo'],
    numeric: ['numeric', 'Precisión libre'],
    smallint: ['smallint', '2 bytes (±32.767)'],
    integer: ['integer', '4 bytes (±2.147.483.647)'],
    bigint: ['bigint', '8 bytes (±9,22 × 10¹⁸)'],
    boolean: ['boolean', '1 byte (verdadero / falso)'],
    'timestamp with time zone': ['timestamptz', '8 bytes (fecha, hora y zona horaria; precisión de microsegundos)'],
    'timestamp without time zone': ['timestamp', '8 bytes (fecha y hora, sin zona)'],
    date: ['date', '4 bytes (solo fecha)'],
    jsonb: ['jsonb', 'Variable (JSON binario)'],
    json: ['json', 'Variable (JSON en texto)'],
    tsvector: ['tsvector', 'Variable (índice de búsqueda de texto)'],
    inet: ['inet', '7 a 19 bytes (dirección IP)'],
  };
  const [tipo, largo] = fijos[t] ?? [t, '—'];
  return { tipo, largo };
}

const limpiarExpr = (s) =>
  s
    .replace(/^CHECK \((.*)\)$/s, '$1')
    .replace(/\((-?\d+(?:\.\d+)?)\)::numeric/g, '$1')
    .replace(/::[a-z_ ]+(\[\])?/gi, '')
    .replace(/^\((.*)\)$/s, '$1');

const limpiarDefecto = (s) => (s ? s.replace(/::[a-z_. ]+(\[\])?/gi, '') : '');

function largoPorCheck(expr) {
  const min = expr.match(/length\(\w+\) >= (\d+)/)?.[1];
  const max = expr.match(/length\(\w+\) <= (\d+)/)?.[1];
  if (min && max) return `Entre ${min} y ${max} caracteres`;
  if (max) return `Hasta ${max} caracteres`;
  if (min) return `Al menos ${min} caracteres`;
  return null;
}

function resumirTrigger(def) {
  const cuando = def.match(/ (BEFORE|AFTER|INSTEAD OF) (.+?) ON /)?.[0].trim().replace(/ ON$/, '') ?? '';
  const filtro = def.match(/ WHEN \((.+)\) EXECUTE/)?.[1];
  const fn = def.match(/EXECUTE (?:FUNCTION|PROCEDURE) ([\w.]+)\(/)?.[1]?.replace(/^public\./, '');
  const traducido = cuando
    .replace('BEFORE', 'Antes de')
    .replace('AFTER', 'Después de')
    .replace(/INSERT/g, 'insertar')
    .replace(/UPDATE OF/g, 'modificar')
    .replace(/UPDATE/g, 'modificar')
    .replace(/DELETE/g, 'borrar')
    .replace(/ OR /g, ' o ');
  return { cuando: traducido + (filtro ? ` (si ${filtro})` : ''), funcion: fn };
}

const CAMPOS_COMUNES = {
  creado_en: 'Fecha y hora de creación',
  actualizado_en: 'Última modificación (la actualiza un trigger)',
  nombre: 'Nombre',
  apellido: 'Apellido',
  slug: 'Identificador legible para URLs',
  descripcion: 'Descripción',
  email: 'Correo electrónico',
  telefono: 'Teléfono',
  activa: 'Si está habilitada',
  activo: 'Si está habilitado',
  orden: 'Orden en que se muestra',
  estado: 'Estado actual',
  motivo: 'Motivo',
  notas: 'Notas internas',
  url: 'Dirección (URL) del archivo',
  avatar_url: 'Foto de perfil (URL)',
  logo_url: 'Logo (URL)',
  portada_url: 'Imagen de portada (URL)',
  monto: 'Importe en pesos',
  total: 'Importe total en pesos',
  subtotal: 'Importe sin envío en pesos',
  precio: 'Precio en pesos',
  cantidad: 'Cantidad de unidades',
  lat: 'Latitud',
  lng: 'Longitud',
  texto: 'Texto del mensaje',
  vence_en: 'Fecha y hora de vencimiento',
};

// Campos sin comentario en la base ni en las migraciones.
const DESCRIPCIONES = {
  'direcciones.alias': 'Nombre corto de la dirección (ej.: "Casa", "Trabajo")',
  'direcciones.calle': 'Calle',
  'direcciones.numero': 'Altura de la calle',
  'direcciones.piso_depto': 'Piso y departamento',
  'direcciones.codigo_postal': 'Código postal',
  'direcciones.referencias': 'Indicaciones para el repartidor (entre calles, color de la casa, etc.)',
  'roles_plataforma.rol': 'Rol de administración asignado',
  'planes.precio_mensual': 'Precio mensual del plan en pesos (0 = gratis)',
  'tiendas.cuit': 'CUIT del comercio',
  'tiendas.razon_social': 'Razón social para facturación',
  'tiendas.direccion': 'Dirección del local (donde se retiran los pedidos)',
  'tiendas.horarios': 'Horarios de atención por día, en JSON',
  'suscripciones.inicio': 'Inicio del período pagado',
  'suscripciones.gracia_hasta': 'Fin del período de gracia: vencido el plan, la tienda sigue activa hasta esta fecha',
  'pagos_suscripcion.mp_payment_id': 'Id del pago en Mercado Pago (evita registrar dos veces el mismo aviso)',
  'cuentas_mp_tienda.mp_user_id': 'Id de la cuenta de Mercado Pago del comercio',
  'cuentas_mp_tienda.refresh_token_cifrado': 'Token de renovación de Mercado Pago, cifrado. Nunca se expone al navegador',
  'permisos.area': 'Área a la que pertenece el permiso (productos, pedidos, equipo, etc.)',
  'categorias.comision_pct': 'Porcentaje de comisión que cobra la plataforma en esta categoría (0 a 100)',
  'atributos.tipo': 'Cómo se carga el valor: lista de opciones, texto, número o sí/no',
  'productos.motivo_pausa': 'Por qué está pausado: manual, por límite del plan o por moderación',
  'producto_atributos.valor_texto': 'Valor del atributo cuando es texto',
  'producto_atributos.valor_numero': 'Valor del atributo cuando es número',
  'variantes.sku': 'Código interno del comercio para la variante',
  'variantes.precio_oferta': 'Precio con descuento (debe ser menor al precio)',
  'variantes.stock': 'Unidades disponibles',
  'imagenes_producto.texto_alternativo': 'Descripción de la imagen para lectores de pantalla',
  'pedidos.numero': 'Número de pedido visible para el cliente (empieza en 1000)',
  'pedidos.estado_pago': 'Estado del pago de la compra completa',
  'pedidos_tienda.modalidad': 'Entrega a domicilio por la plataforma o retiro en el local',
  'pedidos_tienda.comision': 'Comisión de la plataforma sobre esta parte, en pesos',
  'pedidos_tienda.motivo_cancelacion': 'Motivo de la cancelación, si se canceló',
  'pedido_items.nombre_producto': 'Nombre del producto al momento de comprar (copia congelada)',
  'pedido_items.descripcion_variante': 'Variante elegida al comprar (ej.: "Talle M, Rojo")',
  'pedido_items.precio_unitario': 'Precio por unidad al momento de comprar (copia congelada)',
  'historial_estados.estado_anterior': 'Estado antes del cambio',
  'historial_estados.estado_nuevo': 'Estado después del cambio',
  'historial_estados.nota': 'Comentario sobre el cambio',
  'pagos.mp_payment_id': 'Id del pago en Mercado Pago (evita cobrar dos veces el mismo aviso)',
  'pagos.comision_marketplace': 'Comisión total de la plataforma en este pago, en pesos',
  'reembolsos.mp_refund_id': 'Id de la devolución en Mercado Pago',
  'tarifas_envio.costo': 'Costo de envío a la localidad, en pesos',
  'repartidores.vehiculo': 'Vehículo que usa (moto, bici, auto)',
  'envios.costo': 'Costo de envío cobrado al cliente, en pesos',
  'preguntas.texto': 'Pregunta del cliente sobre el producto',
  'preguntas.respuesta': 'Respuesta del comercio',
  'reclamos.resolucion': 'Cómo se resolvió el reclamo',
  'notificaciones.datos': 'Datos extra para armar la notificación (ids, montos, etc.), en JSON',
  'solicitudes_consumidor.tipo': 'Botón de arrepentimiento o pedido de baja del servicio',
  'solicitudes_consumidor.detalle': 'Detalle que escribe la persona',
  'solicitudes_consumidor.codigo_gestion': 'Código que recibe la persona para seguir su solicitud',
  'auditoria.entidad_id': 'Id del registro afectado',
  'auditoria.antes': 'Datos del registro antes del cambio, en JSON',
  'auditoria.despues': 'Datos del registro después del cambio, en JSON',
  'configuracion.clave': 'Nombre del parámetro (ej.: horas_vencimiento_pedido)',
  'configuracion.valor': 'Valor del parámetro, en JSON',
  'users.encrypted_password': 'Contraseña cifrada con bcrypt (nunca se guarda en texto plano)',
  'users.raw_user_meta_data': 'Datos del registro (nombre, apellido); el trigger crear_perfil_al_registrarse los copia a perfiles',
  'users.created_at': 'Fecha y hora de registro',
};

function descripcionAutomatica(col, fk, pk, tabla) {
  if (pk && col.nombre === 'id') return 'Identificador único';
  if (DESCRIPCIONES[`${tabla}.${col.nombre}`]) return DESCRIPCIONES[`${tabla}.${col.nombre}`];
  if (CAMPOS_COMUNES[col.nombre]) return CAMPOS_COMUNES[col.nombre];
  if (fk) return `Referencia a ${fk.ref_tabla}`;
  if (col.typname === 'bool') return `Indica si ${col.nombre.replace(/_/g, ' ')}`;
  if (col.nombre.endsWith('_en') && col.typname === 'timestamptz') return `Fecha y hora: ${col.nombre.replace(/_en$/, '').replace(/_/g, ' ')}`;
  return '';
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const capitalizar = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const ancla = (tabla) => `tabla-${tabla.replace(/\./g, '-')}`;

// ---------------------------------------------------------------------------
// 4. Armado del documento
// ---------------------------------------------------------------------------
function construirTablas(base, origen) {
  return base.tablas.map((t) => {
    const cols = base.columnas.filter((c) => c.oid === t.oid);
    const porNum = Object.fromEntries(cols.map((c) => [c.attnum, c.nombre]));
    const rest = base.restricciones.filter((r) => r.oid === t.oid);
    const pk = rest.find((r) => r.tipo === 'p');
    const fks = rest.filter((r) => r.tipo === 'f');
    const uniques = rest.filter((r) => r.tipo === 'u');
    const checks = rest.filter((r) => r.tipo === 'c');
    const notasSql = origen.tablas[t.nombre]?.columnas ?? {};

    const columnas = cols.map((c) => {
      const esPk = pk?.columnas.length === 1 && porNum[pk.columnas[0]] === c.nombre;
      const fk = fks.find((f) => f.columnas.length === 1 && porNum[f.columnas[0]] === c.nombre);
      const unico = uniques.some((u) => u.columnas.length === 1 && porNum[u.columnas[0]] === c.nombre);
      const reglas = checks
        .filter((k) => k.columnas.length === 1 && porNum[k.columnas[0]] === c.nombre)
        .map((k) => limpiarExpr(k.definicion));
      const { tipo, largo } = describirTipo(c);
      const largoCheck = reglas.map(largoPorCheck).find(Boolean);
      const claves = [
        esPk && 'PK',
        pk && pk.columnas.length > 1 && pk.columnas.some((n) => porNum[n] === c.nombre) && 'PK (compuesta)',
        fk && 'FK',
        unico && 'Único',
      ].filter(Boolean);

      return {
        nombre: c.nombre,
        tipo,
        enumTipo: c.typtype === 'e' ? c.typname : null,
        largo: largoCheck ?? largo,
        nulo: c.no_nulo ? 'No' : 'Sí',
        defecto: limpiarDefecto(c.defecto),
        claves: claves.join(', '),
        referencia: fk ? `${fk.ref_tabla}.${fk.ref_columnas.join(', ')} (${AL_BORRAR[fk.al_borrar]})` : '',
        refTabla: fk?.ref_tabla,
        reglas: reglas.filter((r) => !largoPorCheck(r) || reglas.length > 1).join('; '),
        descripcion: capitalizar(c.comentario || notasSql[c.nombre] || descripcionAutomatica(c, fk, esPk, t.nombre)),
      };
    });

    const nombresDe = (r) => r.columnas.map((n) => porNum[n]).join(', ');
    return {
      nombre: t.nombre,
      descripcion: [origen.tablas[t.nombre]?.descripcion, t.comentario].filter(Boolean).join(' '),
      modulo: origen.tablas[t.nombre]?.modulo,
      rls: t.rls,
      columnas,
      fks: fks.map((f) => ({
        columnas: nombresDe(f),
        ref: f.ref_tabla,
        refColumnas: f.ref_columnas.join(', '),
        alBorrar: AL_BORRAR[f.al_borrar],
        unico:
          uniques.some((u) => nombresDe(u) === nombresDe(f)) ||
          (pk && nombresDe(pk) === nombresDe(f)),
        nulo: f.columnas.some((n) => cols.find((c) => c.attnum === n && !c.no_nulo)),
      })),
      reglasTabla: [
        ...(pk && pk.columnas.length > 1 ? [`Clave primaria compuesta: (${nombresDe(pk)})`] : []),
        ...uniques.filter((u) => u.columnas.length > 1).map((u) => `Combinación única: (${nombresDe(u)})`),
        ...fks.filter((f) => f.columnas.length > 1).map((f) => `FK (${nombresDe(f)}) → ${f.ref_tabla}`),
        ...checks.filter((k) => k.columnas.length !== 1).map((k) => `Regla: ${limpiarExpr(k.definicion)}`),
      ],
      indices: base.indices
        .filter((i) => i.oid === t.oid && !i.de_restriccion)
        .map((i) => ({
          nombre: i.nombre,
          unico: i.unico,
          definicion: i.definicion.replace(/^.*? USING /, ''),
        })),
      triggers: base.triggers.filter((g) => g.oid === t.oid).map((g) => ({ nombre: g.nombre, ...resumirTrigger(g.definicion) })),
      politicas: base.politicas.filter((p) => p.tabla === t.nombre),
    };
  });
}

function tablaMarkdown(t, enumsConocidos) {
  const out = [];
  out.push(`<a id="${ancla(t.nombre)}"></a>`, '', `### \`${t.nombre}\``, '');
  if (t.descripcion) out.push(t.descripcion, '');
  out.push(
    `**${plural(t.columnas.length, 'campo', 'campos')}** · RLS ${t.rls ? 'activo' : '**desactivado**'}` +
      (t.politicas.length ? ` · ${plural(t.politicas.length, 'política', 'políticas')}` : '') +
      (t.triggers.length ? ` · ${plural(t.triggers.length, 'trigger', 'triggers')}` : ''),
    ''
  );
  out.push('| # | Campo | Tipo | Longitud / precisión | Nulo | Por defecto | Clave | Referencia | Reglas | Descripción |');
  out.push('|---|---|---|---|---|---|---|---|---|---|');
  t.columnas.forEach((c, i) => {
    const tipo = c.enumTipo && enumsConocidos.has(c.enumTipo) ? `[enum ${c.enumTipo}](#enum-${c.enumTipo})` : `\`${c.tipo}\``;
    const ref = c.refTabla ? `[${md(c.referencia)}](#${ancla(c.refTabla)})` : '';
    out.push(
      `| ${i + 1} | \`${c.nombre}\` | ${tipo} | ${md(c.largo)} | ${c.nulo} | ${c.defecto ? `\`${md(c.defecto)}\`` : ''} | ${c.claves} | ${ref} | ${c.reglas ? `\`${md(c.reglas)}\`` : ''} | ${md(c.descripcion)} |`
    );
  });
  out.push('');

  if (t.reglasTabla.length) {
    out.push('**Reglas de la tabla**', '', ...t.reglasTabla.map((r) => `- ${r}`), '');
  }
  if (t.indices.length) {
    out.push('**Índices adicionales**', '', ...t.indices.map((i) => `- \`${i.nombre}\`${i.unico ? ' (único)' : ''}: \`${md(i.definicion)}\``), '');
  }
  if (t.triggers.length) {
    out.push('**Triggers**', '', ...t.triggers.map((g) => `- \`${g.nombre}\`: ${md(g.cuando)} → \`${g.funcion}()\``), '');
  }
  if (t.politicas.length) {
    out.push(
      '<details><summary>Políticas RLS</summary>',
      '',
      '| Política | Operación | Roles |',
      '|---|---|---|',
      ...t.politicas.map((p) => `| ${md(p.nombre)} | ${p.comando} | ${p.roles.join(', ')} |`),
      '',
      '</details>',
      ''
    );
  }
  return out;
}

function diagrama(tablas, nombresModulo) {
  const lineas = ['```mermaid', 'erDiagram'];
  const vistas = new Set();
  for (const t of tablas) {
    for (const f of t.fks) {
      const ref = f.ref.replace('.', '_');
      const lado = f.unico ? (f.nulo ? 'o|' : '||') : 'o{';
      const clave = `${ref}-${t.nombre}-${f.columnas}`;
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      lineas.push(`  ${ref} ||--${lado} ${t.nombre} : "${f.columnas}"`);
    }
  }
  for (const n of nombresModulo) if (!lineas.some((l) => new RegExp(`\\b${n}\\b`).test(l))) lineas.push(`  ${n} {}`);
  lineas.push('```');
  return lineas;
}

function construirMarkdown({ modulos, tablas, auth, enums, origen }) {
  const total = (fn) => tablas.reduce((s, t) => s + fn(t), 0);
  const enumsConocidos = new Set(enums.map((e) => e.nombre));
  const out = [];

  out.push(
    '# Modelo de datos · Tu Comercio Local',
    '',
    '> Documento generado automáticamente desde la base de datos con `npm run db:docs` (en `apps/api`).',
    '> No editar a mano: los cambios van en una migración nueva y después se vuelve a generar.',
    '',
    `Generado: ${new Date().toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })}`,
    '',
    '## Resumen',
    '',
    '| Elemento | Cantidad |',
    '|---|---|',
    `| Módulos | ${modulos.length} |`,
    `| Tablas (esquema public) | ${tablas.length} |`,
    `| Campos | ${total((t) => t.columnas.length)} |`,
    `| Relaciones (claves foráneas) | ${total((t) => t.fks.length)} |`,
    `| Tipos enumerados | ${enums.length} |`,
    `| Índices adicionales | ${total((t) => t.indices.length)} |`,
    `| Triggers | ${total((t) => t.triggers.length)} |`,
    `| Políticas RLS | ${total((t) => t.politicas.length)} |`,
    `| Tablas sin RLS | ${tablas.filter((t) => !t.rls).length} |`,
    '',
    '## Cómo leer este documento',
    '',
    '- **Tipo**: tipo de dato en PostgreSQL.',
    '- **Longitud / precisión**: cuánto puede guardar el campo.',
    '  - `text` no tiene largo fijo en PostgreSQL: cuando hay un límite, viene de una regla CHECK.',
    '  - `numeric(12,2)` admite 12 dígitos en total, 2 de ellos decimales.',
    '- **Nulo**: "Sí" si el campo puede quedar vacío.',
    '- **Clave**:',
    '  - **PK**: clave primaria.',
    '  - **FK**: referencia a otra tabla.',
    '  - **Único**: no se puede repetir.',
    '- **Referencia**: tabla y campo al que apunta la FK, y qué pasa si se borra el registro apuntado.',
    '- **Reglas**: restricciones CHECK del campo.',
    '- **RLS**: seguridad por fila. Cada tabla tiene políticas que deciden quién ve o modifica cada registro.',
    '',
    '## Índice',
    ''
  );
  modulos.forEach((m, i) => {
    out.push(`${i + 1}. **${m.titulo}**: ${m.tablas.map((n) => `[${n}](#${ancla(n)})`).join(', ')}`);
  });
  out.push(`${modulos.length + 1}. **Esquema auth**: [auth.users](#${ancla('auth.users')})`);
  out.push(`${modulos.length + 2}. [Tipos enumerados](#tipos-enumerados)`, '');

  for (const m of modulos) {
    const propias = m.tablas.map((n) => tablas.find((t) => t.nombre === n)).filter(Boolean);
    out.push('---', '', `## ${m.titulo}`, '', `Archivo: \`supabase/migrations/${m.archivo}\``, '');
    out.push(...diagrama(propias, m.tablas), '');
    for (const t of propias) out.push(...tablaMarkdown(t, enumsConocidos));
  }

  out.push(
    '---',
    '',
    '## Esquema auth',
    '',
    'En Supabase, `auth.users` la administra Supabase Auth. En PostgreSQL local se simula con `pruebas/supabase_simulado.sql` y contiene solo los campos que usa el proyecto.',
    ''
  );
  for (const t of auth) out.push(...tablaMarkdown({ ...t, nombre: `auth.${t.nombre}` }, enumsConocidos));

  out.push('---', '', '## Tipos enumerados', '', 'Listas cerradas de valores. Un campo de este tipo solo acepta uno de los valores indicados.', '');
  for (const e of enums) {
    const usos = tablas.flatMap((t) => t.columnas.filter((c) => c.enumTipo === e.nombre).map((c) => `\`${t.nombre}.${c.nombre}\``));
    out.push(`<a id="enum-${e.nombre}"></a>`, '', `### \`${e.nombre}\``, '');
    if (e.comentario) out.push(e.comentario, '');
    if (usos.length) out.push(`Usado en: ${usos.join(', ')}`, '');
    out.push('| # | Valor | Significado |', '|---|---|---|');
    e.valores.forEach((v, i) => out.push(`| ${i + 1} | \`${v}\` | ${md(origen.enumValores[e.nombre]?.[v] ?? '')} |`));
    out.push('');
  }
  return out.join('\n');
}

function construirCsv(modulos, tablas, auth) {
  const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const filas = [
    ['Módulo', 'Tabla', '#', 'Campo', 'Tipo', 'Longitud / precisión', 'Nulo', 'Por defecto', 'Clave', 'Referencia', 'Reglas', 'Descripción'],
  ];
  const agregar = (modulo, nombreTabla, t) =>
    t.columnas.forEach((c, i) =>
      filas.push([modulo, nombreTabla, i + 1, c.nombre, c.tipo, c.largo, c.nulo, c.defecto, c.claves, c.referencia, c.reglas, c.descripcion])
    );
  for (const m of modulos) {
    for (const n of m.tablas) {
      const t = tablas.find((x) => x.nombre === n);
      if (t) agregar(m.titulo, n, t);
    }
  }
  for (const t of auth) agregar('Esquema auth', `auth.${t.nombre}`, t);
  return '\uFEFF' + filas.map((f) => f.map(celda).join(';')).join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------------
const db = new pg.Client({ connectionString: url.toString() });
await db.connect();
try {
  const origen = leerMigraciones();
  const publico = await leerBase(db, 'public');
  const esquemaAuth = await leerBase(db, 'auth');
  const enums = await leerEnums(db);
  const tablas = construirTablas(publico, origen);
  const auth = construirTablas(esquemaAuth, origen);
  const modulos = origen.modulos.filter((m) => m.tablas.some((n) => tablas.some((t) => t.nombre === n)));

  const sinModulo = tablas.filter((t) => !modulos.some((m) => m.tablas.includes(t.nombre)));
  if (sinModulo.length) modulos.push({ titulo: 'Otras tablas', archivo: '—', tablas: sinModulo.map((t) => t.nombre) });

  mkdirSync(carpetaDocs, { recursive: true });
  writeFileSync(carpetaDocs + 'MODELO_DATOS.md', construirMarkdown({ modulos, tablas, auth, enums, origen }));
  writeFileSync(carpetaDocs + 'modelo_datos.csv', construirCsv(modulos, tablas, auth));

  const campos = tablas.reduce((s, t) => s + t.columnas.length, 0);
  console.log(`Listo: ${tablas.length} tablas, ${campos} campos y ${enums.length} enums.`);
  console.log('  docs/MODELO_DATOS.md');
  console.log('  docs/modelo_datos.csv');
} finally {
  await db.end();
}
