// Prueba de punta a punta del modelo de datos.
// Simula: dos tiendas, empleados, un cliente comprando a ambas, el pago,
// la recolección y la entrega, y verifica que nadie vea lo que no debe.
//   Ejecutar:  node pruebas/prueba_completa.mjs
import {
  categorias as contratoCategorias, detalleTienda, opcionesRubro, rubro, rubrosAdmin, tiendasResumen, verificar,
} from '@marketplace/contratos';
import { crearBase } from './cargar.mjs';

const db = await crearBase();
let ok = 0, fallas = 0;
const lineas = [];
const log = (s) => { lineas.push(s); console.log(s); };

function check(descripcion, condicion, detalle = '') {
  if (condicion) { ok++; log(`  ✓ ${descripcion}`); }
  else { fallas++; log(`  ✗ ${descripcion} ${detalle}`); }
}

// Cambia de usuario: igual que cuando alguien inicia sesión en la app.
async function como(usuario) {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [usuario ?? '']);
  await db.exec(usuario ? 'set role authenticated' : 'set role anon');
}
// El servidor (clave privada de Supabase).
async function servidor() {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.exec('set role service_role');
}
async function q(sql, params = []) { return (await db.query(sql, params)).rows; }
async function uno(sql, params = []) { return (await q(sql, params))[0]; }
async function falla(sql, params = []) {
  try { await db.query(sql, params); return null; }
  catch (e) { return e.message; }
}

// ---------------------------------------------------------------------------
log('\n1. Cuentas');
await db.exec('reset role');
const crearUsuario = async (email, nombre) =>
  (await uno(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
             [email, { nombre }])).id;
const admin = await crearUsuario('admin@plataforma.com', 'Admin');
const ana   = await crearUsuario('ana@tienda-a.com', 'Ana');     // dueña de la Tienda A
const beto  = await crearUsuario('beto@tienda-b.com', 'Beto');   // dueño de la Tienda B
const carla = await crearUsuario('carla@gmail.com', 'Carla');    // empleada de catálogo en A
const diego = await crearUsuario('diego@gmail.com', 'Diego');    // cliente
const rita  = await crearUsuario('rita@plataforma.com', 'Rita'); // repartidora
await q(`insert into public.roles_plataforma (usuario_id, rol) values ($1, 'superadmin')`, [admin]);
check('El perfil se crea solo al registrarse', (await uno(`select count(*)::int n from public.perfiles`)).n === 6);
check('Solo puede haber un superadmin',
  !!(await falla(`insert into public.roles_plataforma (usuario_id, rol) values ($1, 'superadmin')`, [ana])));

// Las secciones de catálogo y compras publican directo; la revisión de productos
// de tiendas nuevas se prueba en la sección 14.
await q(`update public.configuracion set valor = 'false' where clave = 'revision_productos_habilitada'`);

const capital = (await uno(`select id from public.localidades where slug = 'capital'`)).id;
const iglesia = (await uno(`select id from public.localidades where slug = 'iglesia'`)).id;
const moda = (await uno(`select id from public.rubros where slug = 'indumentaria-y-moda' and padre_id is null`)).id;

// ---------------------------------------------------------------------------
log('\n2. Tiendas y planes');
await como(ana);
check('La tienda nueva exige el rubro principal',
  (await falla(`insert into public.tiendas (nombre, slug, cuit, localidad_id, direccion)
    values ('Sin rubro', 'sin-rubro', '20-11111111-1', $1, 'X 1')`, [capital]))?.includes('rubro principal'));
const tiendaA = (await uno(`insert into public.tiendas (nombre, slug, cuit, localidad_id, direccion, estado, propietario_id, rubro_id)
  values ('Tienda A', 'tienda-a', '20-11111111-1', $1, 'Av. Libertador 100', 'activa', $2, $3) returning id, estado, propietario_id`,
  [capital, beto, moda]));
check('Al crear una tienda, el dueño es quien la crea (aunque mande otro id)', tiendaA.propietario_id === ana);
check('Una tienda nueva queda "pendiente" aunque pida "activa"', tiendaA.estado === 'pendiente');
const A = tiendaA.id;

await como(beto);
const B = (await uno(`insert into public.tiendas (nombre, slug, cuit, localidad_id, direccion, rubro_id)
  values ('Tienda B', 'tienda-b', '20-22222222-2', $1, 'Calle Mitre 200', $2) returning id`, [capital, moda])).id;

await como(admin);
check('No se activa una tienda sin cuenta de Mercado Pago',
  (await falla(`update public.tiendas set estado = 'activa' where id = $1`, [A]))?.includes('Mercado Pago'));

await servidor();
await q(`insert into public.cuentas_mp_tienda (tienda_id, mp_user_id, access_token_cifrado, refresh_token_cifrado, expira_en)
  values ($1, 'mp-a', 'x', 'x', now() + interval '180 days'), ($2, 'mp-b', 'x', 'x', now() + interval '180 days')`, [A, B]);
const plan = async (n) => (await uno(`select id from public.planes where nombre = $1`, [n])).id;
await q(`insert into public.suscripciones (tienda_id, plan_id, estado, fin_periodo)
  values ($1, $2, 'activa', now() + interval '30 days')`, [A, await plan('Premium')]);
await q(`insert into public.suscripciones (tienda_id, plan_id, estado) values ($1, $2, 'activa')`, [B, await plan('Starter')]);

await como(admin);
await q(`update public.tiendas set estado = 'activa' where id in ($1, $2)`, [A, B]);
check('El admin activa las tiendas con cuenta de Mercado Pago vinculada',
  (await uno(`select count(*)::int n from public.tiendas where estado = 'activa'`)).n === 2);

await como(ana);
check('Ana no puede cambiarse el estado de su tienda',
  (await falla(`update public.tiendas set estado = 'suspendida' where id = $1`, [A]))?.includes('administración'));
check('Ana no puede leer los tokens de Mercado Pago, ni los propios',
  !!(await falla(`select * from public.cuentas_mp_tienda`)));

await como(beto);
const B2 = (await uno(`insert into public.tiendas (nombre, slug, cuit, localidad_id, direccion, rubro_id)
  values ('Tienda B2', 'tienda-b2', '20-22222222-2', $1, 'Otra 1', $2) returning id`, [capital, moda])).id;
check('Beto puede tener más de una tienda', !!B2);
await servidor();
check('Pero no dos tiendas con plan gratis',
  (await falla(`insert into public.suscripciones (tienda_id, plan_id, estado) values ($1, $2, 'activa')`,
    [B2, await plan('Starter')]))?.includes('una sola tienda con el plan gratis'));

// ---------------------------------------------------------------------------
log('\n3. Empleados y permisos');
const rolCatalogo = (await uno(`select id from public.roles_tienda where nombre = 'Catálogo' and tienda_id is null`)).id;
await como(ana);
const token = (await uno(`select public.crear_invitacion($1, 'carla@gmail.com', $2) t`, [A, rolCatalogo])).t;
await como(beto);
check('Beto no puede invitar empleados a la tienda de Ana',
  !!(await falla(`select public.crear_invitacion($1, 'x@x.com', $2)`, [A, rolCatalogo])));
await como(diego);
check('La invitación solo la acepta el correo invitado',
  (await falla(`select public.aceptar_invitacion($1)`, [token]))?.includes('otro correo'));
await como(carla);
await q(`select public.aceptar_invitacion($1)`, [token]);
check('Carla aceptó y es empleada activa de la Tienda A',
  (await uno(`select estado from public.miembros_tienda where usuario_id = $1`, [carla])).estado === 'activo');

await como(beto);
const tokenB = (await uno(`select public.crear_invitacion($1, 'carla@gmail.com', $2) t`, [B, rolCatalogo])).t;
await como(carla);
check('El plan gratis no permite empleados (límite 0)',
  (await falla(`select public.aceptar_invitacion($1)`, [tokenB]))?.includes('permite hasta 0 empleados'));

// ---------------------------------------------------------------------------
log('\n4. Catálogo');
const cat = async (ruta) => (await uno(`select id from public.categorias where ruta = $1`, [ruta])).id;
const opcion = async (atr, val) => (await uno(`select o.id from public.atributo_opciones o
  join public.atributos a on a.id = o.atributo_id where a.nombre = $1 and o.valor = $2`, [atr, val])).id;
const atr = async (n) => (await uno(`select id from public.atributos where nombre = $1`, [n])).id;

await como(carla);   // la empleada de catálogo carga el producto
const remera = (await uno(`insert into public.productos (tienda_id, categoria_id, nombre, slug, descripcion)
  values ($1, $2, 'Remera de algodón', 'remera-algodon', 'Remera lisa de algodón peinado') returning id`,
  [A, await cat('/indumentaria-y-calzado/ropa-de-mujer/')])).id;
check('Publicar sin variantes no está permitido',
  (await falla(`update public.productos set estado = 'publicado' where id = $1`, [remera]))?.includes('variante'));
const vM = (await uno(`insert into public.variantes (producto_id, tienda_id, precio, stock) values ($1, $2, 10000, 5) returning id, tienda_id`, [remera, B]));
check('La variante queda en la tienda del producto aunque se mande otra', vM.tienda_id === A);
const vL = (await uno(`insert into public.variantes (producto_id, precio, stock) values ($1, 10000, 1) returning id`, [remera])).id;
await q(`insert into public.variante_opciones (variante_id, atributo_id, opcion_id) values
  ($1, $3, $4), ($1, $5, $6), ($2, $3, $7), ($2, $5, $6)`,
  [vM.id, vL, await atr('Talle'), await opcion('Talle', 'M'), await atr('Color'), await opcion('Color', 'Rojo'), await opcion('Talle', 'L')]);
await q(`update public.productos set estado = 'publicado' where id = $1`, [remera]);
check('Carla (rol Catálogo) publica el producto con talles M y L',
  (await uno(`select estado from public.productos where id = $1`, [remera])).estado === 'publicado');

const hered = await q(`select nombre, define_variante from public.atributos_de_categoria($1)`, [await cat('/indumentaria-y-calzado/calzado-de-mujer/')]);
const calzadoDeMujer = (nombre) => hered.find((r) => r.nombre === nombre);
check('Calzado de mujer varía por Talle y Color y hereda Material de Indumentaria y calzado',
  calzadoDeMujer('Talle')?.define_variante && calzadoDeMujer('Color')?.define_variante &&
  calzadoDeMujer('Material')?.define_variante === false);

check('Carla no ve los pedidos de la tienda (no tiene ese permiso)',
  (await q(`select * from public.pedidos_tienda`)).length === 0);

await como(beto);
check('Beto no ve los borradores de la Tienda A',
  (await q(`select * from public.productos where tienda_id = $1 and estado <> 'publicado'`, [A])).length === 0);
const cambiados = await q(`update public.productos set nombre = 'hackeado' where id = $1 returning id`, [remera]);
check('Beto no puede modificar productos de la Tienda A', cambiados.length === 0);
check('Beto no puede crear productos en la Tienda A',
  !!(await falla(`insert into public.productos (tienda_id, categoria_id, nombre, slug) values ($1, $2, 'x', 'x')`,
    [A, await cat('/hogar-y-decoracion/muebles/')])));

// Límite del plan gratis: 10 productos publicados.
const idsB = [];
for (let i = 1; i <= 11; i++) {
  const p = (await uno(`insert into public.productos (tienda_id, categoria_id, nombre, slug)
    values ($1, $2, $3, $4) returning id`, [B, await cat('/tecnologia-y-electronica/celulares/'), `Zapatillas modelo ${i}`, `zap-${i}`])).id;
  await q(`insert into public.variantes (producto_id, precio, stock) values ($1, 20000, 10)`, [p]);
  idsB.push(p);
}
for (let i = 0; i < 10; i++) await q(`update public.productos set estado = 'publicado' where id = $1`, [idsB[i]]);
check('El plan gratis publica 10 productos',
  (await uno(`select count(*)::int n from public.productos where tienda_id = $1 and estado = 'publicado'`, [B])).n === 10);
check('El producto 11 se rechaza por el límite del plan',
  (await falla(`update public.productos set estado = 'publicado' where id = $1`, [idsB[10]]))?.includes('hasta 10 productos'));

await como(null);  // visitante sin cuenta
check('Un visitante ve los productos publicados de tiendas activas',
  (await q(`select * from public.productos`)).length === 11);
const busq = await q(`select nombre from public.buscar_productos('zapatila')`);
check('La búsqueda tolera errores de tipeo ("zapatila" encuentra zapatillas)', busq.length === 10);
const busq2 = await q(`select nombre from public.buscar_productos('algodon', p_opciones => array[$1]::uuid[])`, [await opcion('Talle', 'L')]);
check('Búsqueda sin acento y filtrada por talle L encuentra la remera', busq2.length === 1);

// ---------------------------------------------------------------------------
log('\n5. Compra a dos tiendas');
await como(diego);
const dir = (await uno(`insert into public.direcciones (usuario_id, calle, numero, localidad_id, es_principal)
  values ($1, 'San Martín', '500', $2, true) returning id`, [diego, capital])).id;
const carrito = (await uno(`insert into public.carritos (usuario_id) values ($1) returning id`, [diego])).id;
const vB = (await uno(`select id from public.variantes where producto_id = $1`, [idsB[0]])).id;
await q(`insert into public.carrito_items (carrito_id, variante_id, cantidad) values ($1, $2, 2), ($1, $3, 1)`, [carrito, vM.id, vB]);

const dirLejos = (await uno(`insert into public.direcciones (usuario_id, calle, numero, localidad_id)
  values ($1, 'Ruta 150', 'km 3', $2) returning id`, [diego, iglesia])).id;
check('No se puede comprar con entrega en una localidad sin tarifa',
  (await falla(`select public.crear_pedido($1)`, [dirLejos]))?.includes('Todavía no hacemos entregas'));

const pedido = (await uno(`select public.crear_pedido($1) id`, [dir])).id;
const ped = await uno(`select * from public.pedidos where id = $1`, [pedido]);
check('Se crea una compra con subtotal $40.000 + envío $2.500 = $42.500',
  Number(ped.subtotal) === 40000 && Number(ped.costo_envio) === 2500 && Number(ped.total) === 42500);
const partes = await q(`select pt.*, t.nombre from public.pedidos_tienda pt join public.tiendas t on t.id = pt.tienda_id where pedido_id = $1 order by t.nombre`, [pedido]);
check('La compra se divide en una parte por tienda', partes.length === 2);
const item = await uno(`select * from public.pedido_items where tienda_id = $1`, [A]);
check('El ítem guarda la variante elegida ("Color: Rojo / Talle: M")', item.descripcion_variante === 'Color: Rojo / Talle: M');
check('El carrito queda vacío', (await q(`select * from public.carrito_items`)).length === 0);

await servidor();
check('El stock queda reservado mientras paga (5 − 2 = 3 disponibles)',
  (await uno(`select public.stock_disponible($1) n`, [vM.id])).n === 3);

await como(ana);
await q(`update public.variantes set precio = 99999 where id = $1`, [vM.id]);
check('Si Ana cambia el precio después, el pedido conserva el precio pagado',
  Number((await uno(`select precio_unitario from public.pedido_items where tienda_id = $1`, [A])).precio_unitario) === 10000);

// ---------------------------------------------------------------------------
log('\n6. Pago (aviso de Mercado Pago)');
await como(diego);
check('Un usuario no puede confirmar un pago por su cuenta',
  !!(await falla(`select public.confirmar_pago($1, 'mp-1', 42500)`, [pedido])));
await servidor();
await q(`select * from public.confirmar_pago($1, 'mp-1', 42500)`, [pedido]);
await q(`select * from public.confirmar_pago($1, 'mp-1', 42500)`, [pedido]);  // aviso repetido
check('Un aviso repetido no cobra dos veces', (await uno(`select count(*)::int n from public.pagos`)).n === 1);
check('Se descuenta el stock al confirmar (5 → 3)', (await uno(`select stock from public.variantes where id = $1`, [vM.id])).stock === 3);
check('Se crea una sola entrega con una recolección por tienda',
  (await uno(`select count(*)::int n from public.envios`)).n === 1 &&
  (await uno(`select count(*)::int n from public.recolecciones`)).n === 2);

// ---------------------------------------------------------------------------
log('\n7. Quién ve qué');
await como(diego);
check('Diego ve su compra con el estado de cada tienda por separado',
  (await q(`select estado from public.pedidos_tienda where pedido_id = $1`, [pedido])).length === 2);
await como(ana);
const verAna = await q(`select tienda_id from public.pedidos_tienda`);
check('Ana ve solo la parte de su tienda', verAna.length === 1 && verAna[0].tienda_id === A);
check('Ana ve los ítems de su parte, no los de Beto',
  (await q(`select * from public.pedido_items`)).every(i => i.tienda_id === A));
check('Ana puede ver el nombre de su comprador',
  (await q(`select nombre from public.perfiles where id = $1`, [diego]))[0]?.nombre === 'Diego');
await como(beto);
check('Beto ve solo la parte de su tienda',
  (await q(`select tienda_id from public.pedidos_tienda`)).every(r => r.tienda_id === B));

// ---------------------------------------------------------------------------
log('\n8. Preparación, recolección y entrega');
const ptA = partes.find(p => p.tienda_id === A).id;
const ptB = partes.find(p => p.tienda_id === B).id;
await como(ana);
check('El comercio no puede marcar "entregado" (lo hace la plataforma)',
  !!(await falla(`update public.pedidos_tienda set estado = 'entregado' where id = $1`, [ptA])));
check('El comercio no puede cambiar el total de su parte',
  (await falla(`update public.pedidos_tienda set total = 1 where id = $1`, [ptA]))?.includes('solo puede cambiar el estado'));
await q(`update public.pedidos_tienda set estado = 'en_preparacion' where id = $1`, [ptA]);
await q(`update public.pedidos_tienda set estado = 'listo_para_recoleccion' where id = $1`, [ptA]);
check('Ana marca su parte "lista para recolección"',
  (await uno(`select estado from public.pedidos_tienda where id = $1`, [ptA])).estado === 'listo_para_recoleccion');

await como(admin);
const repartidor = (await uno(`insert into public.repartidores (usuario_id, nombre, telefono) values ($1, 'Rita', '264-555') returning id`, [rita])).id;
await q(`update public.envios set repartidor_id = $1 where pedido_id = $2`, [repartidor, pedido]);

await como(rita);
check('Rita ve sus dos recolecciones asignadas', (await q(`select * from public.recolecciones`)).length === 2);
check('Rita ve la dirección de entrega', (await q(`select direccion_destino from public.envios`)).length === 1);
await q(`update public.recolecciones set estado = 'recolectada' where pedido_tienda_id = $1`, [ptA]);
check('Rita no puede retirar en la Tienda B si no está lista',
  (await falla(`update public.recolecciones set llegada_en = now(), estado = 'recolectada' where pedido_tienda_id = $1`, [ptB]))?.includes('todavía no marcó'));
await q(`update public.recolecciones set llegada_en = now() - interval '12 minutes' where pedido_tienda_id = $1`, [ptB]);

await como(beto);
await q(`update public.pedidos_tienda set estado = 'en_preparacion' where id = $1`, [ptB]);
await q(`update public.pedidos_tienda set estado = 'listo_para_recoleccion' where id = $1`, [ptB]);

await como(rita);
await q(`update public.recolecciones set estado = 'recolectada' where pedido_tienda_id = $1`, [ptB]);
const espera = await uno(`select round(extract(epoch from recolectado_en - llegada_en) / 60) m from public.recolecciones where pedido_tienda_id = $1`, [ptB]);
check('Queda registrado cuánto esperó Rita en la Tienda B (12 minutos)', Number(espera.m) === 12);
check('Con todo recolectado, la entrega sale "en camino" sola',
  (await uno(`select estado from public.envios where pedido_id = $1`, [pedido])).estado === 'en_camino');
await q(`update public.envios set estado = 'entregado' where pedido_id = $1`, [pedido]);

await como(diego);
const finales = await q(`select estado from public.pedidos_tienda where pedido_id = $1`, [pedido]);
check('Al entregar, las dos partes quedan "entregado"', finales.every(f => f.estado === 'entregado'));
check('El historial registra cada cambio de estado',
  (await uno(`select count(*)::int n from public.historial_estados where pedido_tienda_id = $1`, [ptA])).n === 6);
check('Diego recibió avisos de cada cambio', (await q(`select * from public.notificaciones`)).length >= 10);

// ---------------------------------------------------------------------------
log('\n9. Cancelación de una sola tienda');
await como(diego);
await q(`insert into public.carrito_items (carrito_id, variante_id, cantidad) values ($1, $2, 1), ($1, $3, 1)`, [carrito, vM.id, vB]);
const pedido2 = (await uno(`select public.crear_pedido($1) id`, [dir])).id;
await servidor();
const total2 = (await uno(`select total from public.pedidos where id = $1`, [pedido2])).total;
await q(`select * from public.confirmar_pago($1, 'mp-2', $2)`, [pedido2, total2]);
const stockAntes = (await uno(`select stock from public.variantes where id = $1`, [vB])).stock;
await como(beto);
check('Cancelar sin motivo no está permitido',
  (await falla(`update public.pedidos_tienda set estado = 'cancelado' where pedido_id = $1`, [pedido2]))?.includes('motivo'));
await q(`update public.pedidos_tienda set estado = 'cancelado', motivo_cancelacion = 'Sin stock real' where pedido_id = $1`, [pedido2]);
await servidor();
check('Al cancelar, el stock vuelve (+1)', (await uno(`select stock from public.variantes where id = $1`, [vB])).stock === stockAntes + 1);
check('Se genera un reembolso solo por la parte de Beto ($20.000)',
  Number((await uno(`select r.monto from public.reembolsos r join public.pedidos_tienda pt on pt.id = r.pedido_tienda_id where pt.pedido_id = $1`, [pedido2])).monto) === 20000);
check('La parte de Ana sigue su curso',
  (await uno(`select estado from public.pedidos_tienda where pedido_id = $1 and tienda_id = $2`, [pedido2, A])).estado === 'pago_confirmado');

// ---------------------------------------------------------------------------
log('\n10. Cambio de plan y vencimiento');
await como(carla);
for (let i = 1; i <= 11; i++) {
  const p = (await uno(`insert into public.productos (tienda_id, categoria_id, nombre, slug) values ($1, $2, $3, $4) returning id`,
    [A, await cat('/hogar-y-decoracion/decoracion/'), `Lámpara ${i}`, `lampara-${i}`])).id;
  await q(`insert into public.variantes (producto_id, precio, stock) values ($1, 5000, 3)`, [p]);
  await q(`update public.productos set estado = 'publicado' where id = $1`, [p]);
}
await servidor();
await q(`update public.suscripciones set estado = 'cancelada' where tienda_id = $1`, [A]);
await q(`insert into public.suscripciones (tienda_id, plan_id, estado) values ($1, $2, 'activa')`, [A, await plan('Starter')]);
check('Al bajar de Premium (12 publicados) a Starter, quedan 10 publicados',
  (await uno(`select count(*)::int n from public.productos where tienda_id = $1 and estado = 'publicado'`, [A])).n === 10);
check('Los 2 más recientes pasan a "pausado por límite del plan", sin borrarse',
  (await uno(`select count(*)::int n from public.productos where tienda_id = $1 and motivo_pausa = 'limite_plan'`, [A])).n === 2);
check('Carla queda suspendida (el plan gratis no admite empleados)',
  (await uno(`select estado from public.miembros_tienda where usuario_id = $1`, [carla])).estado === 'suspendido');
await como(carla);
check('Suspendida, Carla ya no ve los borradores de la tienda',
  (await q(`select * from public.productos where tienda_id = $1 and estado <> 'publicado'`, [A])).length === 0);

await servidor();
await q(`update public.suscripciones set fin_periodo = now() - interval '3 days' where tienda_id = $1 and estado = 'activa'`, [B]);
await q(`select public.procesar_vencimientos_suscripciones()`);
check('Una suscripción impaga hace 3 días queda "en gracia" y la tienda sigue activa',
  (await uno(`select estado from public.suscripciones where tienda_id = $1 order by creado_en desc limit 1`, [B])).estado === 'en_gracia'
  && (await uno(`select estado from public.tiendas where id = $1`, [B])).estado === 'activa');
await q(`update public.suscripciones set gracia_hasta = now() - interval '1 minute' where tienda_id = $1 and estado = 'en_gracia'`, [B]);
await q(`select public.procesar_vencimientos_suscripciones()`);
check('Terminada la gracia (7 días), la Tienda B queda "vencida"',
  (await uno(`select estado from public.tiendas where id = $1`, [B])).estado === 'vencida');
await como(null);
check('Los productos de una tienda vencida dejan de verse en el marketplace',
  (await q(`select * from public.productos where tienda_id = $1`, [B])).length === 0);
await como(beto);
check('Pero Beto sigue viendo su catálogo (nada se borró)',
  (await q(`select * from public.productos where tienda_id = $1`, [B])).length === 11);

// ---------------------------------------------------------------------------
log('\n11. Auditoría, preguntas y consumidor');
await como(ana);
check('Ana ve la auditoría de su tienda', (await q(`select * from public.auditoria where tienda_id = $1`, [A])).length > 0);
check('Ana no ve la auditoría de la Tienda B', (await q(`select * from public.auditoria where tienda_id = $1`, [B])).length === 0);
check('Nadie puede borrar la auditoría', (await q(`delete from public.auditoria returning id`)).length === 0);

await como(diego);
const preg = (await uno(`insert into public.preguntas (producto_id, texto, respuesta) values ($1, '¿Viene en azul?', 'Sí') returning id, respuesta, usuario_id`, [remera]));
check('Diego pregunta (y no puede escribirse la respuesta él mismo)', preg.respuesta === null && preg.usuario_id === diego);
await como(ana);
await q(`update public.preguntas set respuesta = 'Por ahora solo en rojo' where id = $1`, [preg.id]);
check('Ana responde y queda registrado quién respondió',
  (await uno(`select respondida_por from public.preguntas where id = $1`, [preg.id])).respondida_por === ana);

await como(null);
const sol = await uno(`select public.enviar_solicitud_consumidor('arrepentimiento', 'Diego', 'diego@gmail.com', '1000') codigo`);
check('El Botón de Arrepentimiento funciona sin iniciar sesión y da un código', /^SC-\d{6}$/.test(sol.codigo));
check('Un visitante no puede leer las solicitudes de otros',
  !!(await falla(`select * from public.solicitudes_consumidor`)) || (await q(`select * from public.solicitudes_consumidor`)).length === 0);

// ---------------------------------------------------------------------------
log('\n12. Correcciones de la revisión');

// Envío: cuando se cancela también la parte de Ana, no queda nada por entregar.
await como(ana);
await q(`update public.pedidos_tienda set estado = 'cancelado', motivo_cancelacion = 'El cliente lo pidió'
  where pedido_id = $1 and tienda_id = $2`, [pedido2, A]);
await servidor();
const envio2 = await q(`select r.monto from public.reembolsos r join public.pedidos_tienda pt on pt.id = r.pedido_tienda_id
  where pt.pedido_id = $1 and r.es_envio`, [pedido2]);
check('Cancelada la última parte con entrega, se devuelve el envío una sola vez ($2.500)',
  envio2.length === 1 && Number(envio2[0].monto) === 2500);
check('Y la entrega queda cancelada ("fallido")',
  (await uno(`select estado from public.envios where pedido_id = $1`, [pedido2])).estado === 'fallido');

// Pago con un monto distinto del total.
const lampara = (await uno(`select v.id from public.variantes v join public.productos p on p.id = v.producto_id
  where p.tienda_id = $1 and p.estado = 'publicado' and p.slug like 'lampara-%' order by p.slug limit 1`, [A])).id;
const comprarLampara = async () => {
  await como(diego);
  await q(`insert into public.carrito_items (carrito_id, variante_id, cantidad) values ($1, $2, 1)`, [carrito, lampara]);
  const id = (await uno(`select public.crear_pedido($1) id`, [dir])).id;
  await servidor();
  return id;
};
const pedido3 = await comprarLampara();
check('Un pago por menos del total no confirma el pedido',
  (await falla(`select * from public.confirmar_pago($1, 'mp-3', 1)`, [pedido3]))?.includes('no coincide'));
check('El pedido sigue pendiente de pago',
  (await uno(`select estado_pago from public.pedidos where id = $1`, [pedido3])).estado_pago === 'pendiente');
await q(`select * from public.confirmar_pago($1, 'mp-3', 7500)`, [pedido3]);
check('Con el monto correcto ($7.500) se confirma',
  (await uno(`select estado from public.pedidos_tienda where pedido_id = $1`, [pedido3])).estado === 'pago_confirmado');

// Pedido sin pago que se cierra solo y después se paga tarde.
const pedido4 = await comprarLampara();
await q(`update public.pedidos set creado_en = now() - interval '25 hours' where id = $1`, [pedido4]);
check('Los pedidos con más de 24 h sin pago se cierran solos',
  (await uno(`select public.cerrar_pedidos_sin_pago() n`)).n === 1 &&
  (await uno(`select estado from public.pedidos_tienda where pedido_id = $1`, [pedido4])).estado === 'rechazado');
check('Y liberan el stock reservado',
  (await uno(`select count(*)::int n from public.reservas_stock where pedido_id = $1`, [pedido4])).n === 0);
await como(ana);
check('Un comercio no puede reabrir una parte rechazada',
  (await falla(`update public.pedidos_tienda set estado = 'pendiente' where pedido_id = $1`, [pedido4]))?.includes('plataforma'));
await servidor();
await q(`select * from public.confirmar_pago($1, 'mp-4', 7500)`, [pedido4]);
check('Si Mercado Pago aprueba después de un rechazo, el pedido se reabre y se confirma',
  (await uno(`select estado_pago from public.pedidos where id = $1`, [pedido4])).estado_pago === 'aprobado' &&
  (await uno(`select estado from public.pedidos_tienda where pedido_id = $1`, [pedido4])).estado === 'pago_confirmado');

// Categorías: renombrar la raíz mueve todo el subárbol.
await como(admin);
const atributosCalzado = hered.length;
await q(`update public.categorias set slug = 'ropa' where ruta = '/indumentaria-y-calzado/'`);
check('Al renombrar una categoría, sus subcategorías actualizan la ruta',
  !!(await uno(`select id from public.categorias where ruta = '/ropa/calzado-de-mujer/'`)) &&
  !(await uno(`select id from public.categorias where ruta like '/indumentaria-y-calzado/%'`)));
check('Calzado sigue heredando los atributos después del cambio',
  (await q(`select nombre from public.atributos_de_categoria($1)`, [await cat('/ropa/calzado-de-mujer/')])).length === atributosCalzado);
check('Una categoría no puede quedar dentro de sus propias subcategorías',
  (await falla(`update public.categorias set padre_id = $1 where ruta = '/ropa/'`,
    [await cat('/ropa/calzado-de-mujer/')]))?.includes('propias subcategorías'));

// Suscripción cancelada sin reemplazo.
await servidor();
await q(`update public.suscripciones set estado = 'cancelada' where tienda_id = $1 and estado = 'activa'`, [A]);
check('Cancelada la suscripción, sin otra vigente, la tienda queda "vencida"',
  (await uno(`select estado from public.tiendas where id = $1`, [A])).estado === 'vencida');

// ---------------------------------------------------------------------------
log('\n13. Panel de administración');
await db.exec('reset role');
await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
const mora = await crearUsuario('mora@plataforma.com', 'Mora');
await q(`insert into public.roles_plataforma (usuario_id, rol) values ($1, 'moderacion')`, [mora]);
const tableroAdmin = (await uno(`select pkg_admin.tablero($1) t`, [admin])).t;
check('El superadmin ve todas las cifras del tablero',
  ['tiendas', 'usuarios', 'pedidos', 'ventasMes', 'suscripciones', 'envios'].every((k) => k in tableroAdmin));
const tableroMora = (await uno(`select pkg_admin.tablero($1) t`, [mora])).t;
check('Moderación ve tiendas y productos, pero no ventas ni usuarios',
  'tiendas' in tableroMora && 'productos' in tableroMora && !('ventasMes' in tableroMora) && !('usuarios' in tableroMora));
check('Alguien sin rol de plataforma no ve el tablero',
  (await falla(`select pkg_admin.tablero($1)`, [diego]))?.includes('solo para el equipo'));

await como(diego);
check('El tablero no se puede llamar desde el navegador',
  (await falla(`select pkg_admin.tablero($1)`, [diego]))?.includes('permission denied'));
await como(mora);
check('Moderación no puede cambiar la configuración general',
  (await falla(`select pkg_admin.guardar_configuracion('minutos_reserva_stock', '20')`))?.includes('Solo el superadmin'));
await como(admin);
check('La configuración valida el rango permitido',
  (await falla(`select pkg_admin.guardar_configuracion('minutos_reserva_stock', '500')`))?.includes('entre 5 y 120'));
check('La configuración conserva el tipo del parámetro',
  (await falla(`select pkg_admin.guardar_configuracion('minutos_reserva_stock', 'true')`))?.includes('número'));
check('Un parámetro que no existe da error',
  (await falla(`select pkg_admin.guardar_configuracion('no_existe', '1')`))?.includes('No existe'));
await q(`select pkg_admin.guardar_configuracion('minutos_reserva_stock', '20')`);
await q(`select pkg_admin.guardar_configuracion('retiro_en_local_habilitado', 'false')`);
check('El superadmin cambia la configuración y la base la usa al instante',
  (await uno(`select public.config_int('minutos_reserva_stock') n`)).n === 20 &&
  (await uno(`select public.config_bool('retiro_en_local_habilitado') b`)).b === false);

await db.exec('reset role');
await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
const parametros = (await uno(`select pkg_admin.configuracion() c`)).c;
const reserva = parametros.find((p) => p.clave === 'minutos_reserva_stock');
check('La configuración muestra quién hizo el último cambio',
  reserva.valor === 20 && reserva.tipo === 'entero' && reserva.actualizadoPor === 'Admin');
const act = (await uno(`select pkg_admin.actividad('configuracion') a`)).a;
check('El registro de actividad muestra el cambio con el valor anterior y el nuevo',
  act.items[0].actor?.nombre === 'Admin' &&
  act.items.some((i) => i.referencia === 'minutos_reserva_stock' &&
    i.cambios.some((c) => c.campo === 'valor' && c.antes === 15 && c.despues === 20)));
const pagina1 = (await uno(`select pkg_admin.actividad(null, null, 2) a`)).a;
const pagina2 = (await uno(`select pkg_admin.actividad(null, $1, 2) a`, [pagina1.siguiente])).a;
check('El registro de actividad se pagina sin repetir movimientos',
  pagina1.items.length === 2 && pagina2.items.length === 2 && pagina2.items[0].id < pagina1.items[1].id);
check('Solo la primera página trae el resumen del filtro',
  pagina1.resumen?.total >= 4 && pagina2.resumen === null &&
  pagina1.resumen.total === pagina1.resumen.altas + pagina1.resumen.cambios + pagina1.resumen.bajas);
const soloCambios = (await uno(
  `select pkg_admin.actividad(p_entidad => 'configuracion', p_accion => 'UPDATE') a`)).a;
check('La actividad se filtra por tipo de acción',
  soloCambios.items.length > 0 && soloCambios.items.every((i) => i.accion === 'UPDATE') &&
  soloCambios.resumen.altas === 0 && soloCambios.resumen.cambios === soloCambios.resumen.total);
const futuro = (await uno(`select pkg_admin.actividad(p_desde => now() + interval '1 day') a`)).a;
const ultimaHora = (await uno(
  `select pkg_admin.actividad(p_desde => now() - interval '1 hour', p_hasta => now() + interval '1 minute') a`)).a;
check('La actividad se filtra por período (desde incluido, hasta excluido)',
  futuro.items.length === 0 && futuro.resumen.total === 0 && ultimaHora.resumen.total === pagina1.resumen.total);
const buscada = (await uno(`select pkg_admin.actividad(p_buscar => 'MINUTOS_reserva') a`)).a;
check('La actividad se busca por referencia, autor o tienda sin importar mayúsculas',
  buscada.items.length > 0 && buscada.items.every((i) => i.referencia === 'minutos_reserva_stock'));
const deSistema = (await uno(`select pkg_admin.actividad(p_origen => 'sistema') a`)).a;
const dePersonas = (await uno(`select pkg_admin.actividad(p_origen => 'personas') a`)).a;
check('La actividad separa lo que hicieron las personas de lo que hizo el sistema',
  deSistema.items.every((i) => i.actor === null) && dePersonas.items.every((i) => i.actor !== null) &&
  deSistema.resumen.total + dePersonas.resumen.total === pagina1.resumen.total);
check('Un período al revés da error',
  (await falla(`select pkg_admin.actividad(p_desde => now(), p_hasta => now() - interval '1 day')`))?.includes('anterior'));
const exportada = (await uno(`select pkg_admin.exportar_actividad(p_entidad => 'configuracion') a`)).a;
check('La exportación trae todos los movimientos del filtro',
  exportada.recortado === false &&
  exportada.items.length === (await uno(`select pkg_admin.actividad('configuracion') a`)).a.resumen.total);

// ---------------------------------------------------------------------------
log('\n14. Moderación de tiendas y productos');
const comoServidorDb = async () => {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
};
await comoServidorDb();
await q(`update public.configuracion set valor = 'true' where clave = 'revision_productos_habilitada'`);
// La Tienda B quedó vencida en la sección 10: vuelve con el plan gratis.
await q(`insert into public.suscripciones (tienda_id, plan_id, estado) values ($1, $2, 'activa')`, [B, await plan('Starter')]);
await q(`update public.tiendas set estado = 'activa' where id = $1 and estado <> 'activa'`, [B]);
check('Una tienda sin productos aprobados manda a revisión lo que publica',
  (await uno(`select public.tienda_requiere_revision($1) r`, [B2])).r === true);
check('Una tienda con historial publica sin revisión',
  (await uno(`select public.tienda_requiere_revision($1) r`, [B])).r === false);

await como(mora);
const politica = (await uno(`select pkg_admin.politica_revision($1, 'siempre') r`, [B])).r;
check('Moderación puede pedir revisión de todo lo que publique una tienda', politica.revisionActiva === true);
await como(beto);
await q(`update public.tiendas set revision_productos = 'nunca', motivo_estado = 'x' where id = $1`, [B]);
check('El dueño no puede cambiar la revisión de su tienda',
  (await uno(`select revision_productos, motivo_estado from public.tiendas where id = $1`, [B])).revision_productos === 'siempre');

// Deja lugar en el plan gratis (10 publicados) para los productos nuevos.
await q(`update public.productos set estado = 'pausado' where id = any($1::uuid[])`, [[idsB[0], idsB[1]]]);
const nuevoProducto = async (nombre, slug) => {
  const id = (await uno(`insert into public.productos (tienda_id, categoria_id, nombre, slug)
    values ($1, $2, $3, $4) returning id`, [B, await cat('/tecnologia-y-electronica/celulares/'), nombre, slug])).id;
  await q(`insert into public.variantes (producto_id, precio, stock) values ($1, 15000, 3)`, [id]);
  return id;
};
const cargador = await nuevoProducto('Cargador rápido', 'cargador-rapido');
await q(`update public.productos set estado = 'publicado' where id = $1`, [cargador]);
const estadoDe = (id) => uno(`select estado, motivo_pausa, nota_moderacion, aprobado_por, publicado_en
  from public.productos where id = $1`, [id]);
let pc = await estadoDe(cargador);
check('Al publicar, el producto queda esperando revisión', pc.estado === 'pausado' && pc.motivo_pausa === 'revision');
await q(`update public.productos set motivo_pausa = 'manual' where id = $1`, [cargador]);
check('El vendedor no puede sacarlo de revisión cambiando el motivo',
  (await estadoDe(cargador)).motivo_pausa === 'revision');
await como(null);
check('Un producto en revisión no se ve en el sitio',
  (await q(`select id from public.productos where id = $1`, [cargador])).length === 0);

await comoServidorDb();
const cola = (await uno(`select pkg_admin.productos('revision') r`)).r;
check('La cola de moderación muestra el producto con su tienda',
  cola.items.some((p) => p.id === cargador && p.tienda.id === B) && cola.conteos.revision >= 1);

await como(mora);
check('Rechazar pide una nota para el vendedor',
  (await falla(`select pkg_admin.moderar_producto($1, 'rechazar', 'no')`, [cargador]))?.includes('qué tiene que corregir'));
await q(`select pkg_admin.moderar_producto($1, 'rechazar', 'Faltan fotos del producto')`, [cargador]);
pc = await estadoDe(cargador);
check('El rechazo deja el producto pausado con la nota de moderación',
  pc.motivo_pausa === 'rechazado' && pc.nota_moderacion === 'Faltan fotos del producto');

await como(beto);
await q(`update public.productos set nota_moderacion = null where id = $1`, [cargador]);
check('El vendedor no puede borrar la nota de moderación',
  (await estadoDe(cargador)).nota_moderacion === 'Faltan fotos del producto');
await q(`update public.productos set estado = 'publicado' where id = $1`, [cargador]);
check('Corregido y publicado de nuevo, vuelve a revisión',
  (await estadoDe(cargador)).motivo_pausa === 'revision');

await como(mora);
await q(`select pkg_admin.moderar_producto($1, 'aprobar')`, [cargador]);
pc = await estadoDe(cargador);
check('Moderación aprueba: queda publicado, sin nota y con quién lo aprobó',
  pc.estado === 'publicado' && pc.nota_moderacion === null && pc.aprobado_por === mora && !!pc.publicado_en);
check('Aprobar dos veces avisa que ya no está en revisión',
  (await falla(`select pkg_admin.moderar_producto($1, 'aprobar')`, [cargador]))?.includes('ya no está esperando'));
await q(`select pkg_admin.moderar_producto($1, 'pausar', 'Infringe una marca registrada')`, [cargador]);
await como(beto);
check('El vendedor no puede volver a publicar un producto pausado por moderación',
  (await falla(`update public.productos set estado = 'publicado' where id = $1`, [cargador]))?.includes('moderación'));
await como(mora);
await q(`select pkg_admin.moderar_producto($1, 'reactivar')`, [cargador]);
check('Moderación lo reactiva', (await estadoDe(cargador)).estado === 'publicado');

await q(`select pkg_admin.politica_revision($1, 'automatica')`, [B]);
await como(beto);
const funda = await nuevoProducto('Funda de silicona', 'funda-silicona');
await q(`update public.productos set estado = 'publicado' where id = $1`, [funda]);
check('Con revisión automática y buen historial, publica al instante',
  (await estadoDe(funda)).estado === 'publicado');

await como(mora);
check('Suspender una tienda pide un motivo',
  (await falla(`select pkg_admin.cambiar_estado_tienda($1, 'suspendida')`, [B]))?.includes('motivo'));
await q(`select pkg_admin.cambiar_estado_tienda($1, 'suspendida', 'Documentación vencida')`, [B]);
await como(beto);
check('El dueño ve por qué suspendieron su tienda',
  (await uno(`select pkg_tiendas.detalle($1) d`, [B])).d.motivo_estado === 'Documentación vencida');
await como(mora);
check('Cambiar al mismo estado avisa que ya está así',
  (await falla(`select pkg_admin.cambiar_estado_tienda($1, 'suspendida', 'Otra vez')`, [B]))?.includes('ya está'));
await q(`select pkg_admin.cambiar_estado_tienda($1, 'activa')`, [B]);

await comoServidorDb();
const listado = (await uno(`select pkg_admin.tiendas(null, 'BETO@tienda') r`)).r;
check('El listado de tiendas busca por correo del dueño y trae sus cifras',
  listado.total === 2 && listado.items.every((t) => t.duenio.email === 'beto@tienda-b.com') &&
  listado.items.find((t) => t.id === B)?.productos.publicados >= 9);
const ficha = (await uno(`select pkg_admin.tienda($1) r`, [B])).r;
check('La ficha de la tienda muestra sus otras tiendas y el historial con el motivo',
  ficha.duenio.otrasTiendas.some((t) => t.id === B2) &&
  ficha.historial.some((h) => h.estado === 'suspendida' && h.motivo === 'Documentación vencida') &&
  ficha.historial.some((h) => h.revision === 'siempre'));
const revision = (await uno(`select pkg_admin.producto($1) r`, [cargador])).r;
check('La ficha del producto trae variantes e historial de moderación',
  revision.variantes.length === 1 && revision.historial.some((h) => h.motivo === 'rechazado'));
check('El tablero de moderación cuenta los productos en revisión',
  'enRevision' in (await uno(`select pkg_admin.tablero($1) t`, [mora])).t.productos);
await como(diego);
check('El listado de tiendas no se puede llamar desde el navegador',
  (await falla(`select pkg_admin.tiendas()`))?.includes('permission denied'));
check('Un cliente no puede moderar productos',
  (await falla(`select pkg_admin.moderar_producto($1, 'aprobar')`, [cargador]))?.includes('Solo moderación'));

// ---------------------------------------------------------------------------
log('\n15. Catálogo y territorio');
await comoServidorDb();
const logi = await crearUsuario('lucas@plataforma.com', 'Lucas');
await q(`insert into public.roles_plataforma (usuario_id, rol) values ($1, 'logistica')`, [logi]);
const guardarCat = (id, nombre, slug, padre, comision = 0) =>
  uno(`select pkg_admin.guardar_categoria($1, $2, $3, $4, $5) r`, [id, nombre, slug, padre, comision]).then((x) => x.r);

await como(mora);
const deportes = (await guardarCat(null, 'Deportes', 'deportes', null, 5)).id;
const bici = await guardarCat(null, 'Bicicletas', 'bicicletas', deportes);
check('Moderación crea una categoría y una subcategoría', bici.ruta === '/deportes/bicicletas/' && bici.activa === true);
check('No puede haber dos categorías con el mismo nombre en el mismo lugar',
  (await falla(`select pkg_admin.guardar_categoria(null, 'Bicis', 'bicicletas', $1, 0)`, [deportes]))?.includes('Ya hay una categoría'));
check('Una categoría no puede quedar dentro de sus propias subcategorías (desde el panel)',
  (await falla(`select pkg_admin.guardar_categoria($1, 'Deportes', null, $2, 5)`, [deportes, bici.id]))?.includes('propias subcategorías'));
await guardarCat(deportes, 'Deportes de aventura', null, null, 5);
check('Renombrar no cambia la dirección web',
  (await uno(`select nombre, ruta from public.categorias where id = $1`, [deportes])).ruta === '/deportes/');

const rodado = (await uno(`select pkg_admin.guardar_atributo(null, 'Rodado BMX', 'lista', null, true) r`)).r.id;
await q(`select pkg_admin.guardar_opcion($1, null, '26'), pkg_admin.guardar_opcion($1, null, '29')`, [rodado]);
check('Las opciones de un atributo no se repiten',
  (await falla(`select pkg_admin.guardar_opcion($1, null, '29')`, [rodado]))?.includes('ya existe'));
check('Un atributo de texto no puede generar variantes',
  (await falla(`select pkg_admin.guardar_atributo_categoria($1, $2, false, true)`, [deportes, await atr('Material')]))?.includes('tipo lista'));
await q(`select pkg_admin.guardar_atributo_categoria($1, $2, false, true)`, [deportes, rodado]);
check('Las subcategorías heredan las variantes de la categoría',
  (await q(`select 1 from public.atributos_de_categoria($1) where atributo_id = $2 and define_variante and obligatorio`,
    [bici.id, rodado])).length === 1);
check('Un atributo heredado no se vuelve a cargar en la subcategoría',
  (await falla(`select pkg_admin.guardar_atributo_categoria($1, $2, true, false)`, [bici.id, rodado]))?.includes('Ya lo hereda'));
const celulares = await cat('/tecnologia-y-electronica/celulares/');
check('Con productos cargados, la categoría no cambia sus variantes',
  (await falla(`select pkg_admin.guardar_atributo_categoria($1, $2, false, true)`, [celulares, rodado]))?.includes('Ya hay productos') &&
  (await falla(`select pkg_admin.quitar_atributo_categoria($1, $2)`, [celulares, await atr('Color')]))?.includes('Ya hay productos'));
check('Una categoría con productos no se mueve a otra con distintas variantes',
  (await falla(`select pkg_admin.guardar_categoria($1, 'Celulares', null, $2, 0)`, [celulares, deportes]))?.includes('otras variantes'));
check('El tipo de un atributo en uso no se cambia',
  (await falla(`select pkg_admin.guardar_atributo($1, 'Rodado BMX', 'texto', null, true)`, [rodado]))?.includes('tipo no se puede'));

const alquileresCat = await cat('/alquileres/');
await q(`select pkg_admin.ordenar_categoria($1, 'subir')`, [deportes]);
const menu = (await uno(`select pkg_catalogo.categorias() c`)).c;
check('El menú respeta el orden que fija moderación',
  menu.findIndex((c) => c.id === deportes) < menu.findIndex((c) => c.id === alquileresCat) &&
  menu.findIndex((c) => c.id === bici.id) === menu.findIndex((c) => c.id === deportes) + 1);

// Ocultar una categoría con productos publicados.
const tecnologia = await cat('/tecnologia-y-electronica/');
const enTecnologia = (await uno(`select count(*)::int n from public.categorias where ruta like '/tecnologia-y-electronica/%'`)).n;
const vFunda = (await uno(`select id from public.variantes where producto_id = $1`, [funda])).id;
await como(diego);
await q(`insert into public.carrito_items (carrito_id, variante_id, cantidad) values ($1, $2, 1)
  on conflict (carrito_id, variante_id) do nothing`, [carrito, vFunda]);
await como(mora);
const oculta = (await uno(`select pkg_admin.activar_categoria($1, false) r`, [tecnologia])).r;
check('Ocultar una categoría oculta también sus subcategorías y la saca de los carritos',
  oculta.categorias === enTecnologia && oculta.carritos >= 1 && oculta.productos >= 1);
await como(null);
check('Sus productos dejan de verse en el sitio',
  (await q(`select id from public.productos where id = $1`, [funda])).length === 0 &&
  !(await uno(`select pkg_catalogo.categorias() c`)).c.some((c) => c.id === tecnologia));
await como(beto);
check('La tienda los sigue viendo en su panel, con su categoría',
  (await uno(`select pkg_productos.listar($1) l`, [B])).l.productos.some((p) => p.id === funda && p.categoria === 'Celulares'));
await como(diego);
check('El producto oculto sale del carrito del cliente',
  (await q(`select 1 from public.carrito_items where variante_id = $1`, [vFunda])).length === 0);
await como(mora);
check('Una subcategoría no se muestra si su categoría está oculta',
  (await falla(`select pkg_admin.activar_categoria($1, true)`, [celulares]))?.includes('Primero mostrá'));
await q(`select pkg_admin.activar_categoria($1, true)`, [tecnologia]);
await como(null);
check('Al mostrarla de nuevo, sus productos vuelven al sitio',
  (await q(`select id from public.productos where id = $1`, [funda])).length === 1);

await como(mora);
check('No se borra una categoría con subcategorías',
  (await falla(`select pkg_admin.eliminar_categoria($1)`, [deportes]))?.includes('subcategorías'));
check('No se borra una categoría con productos',
  (await falla(`select pkg_admin.eliminar_categoria($1)`, [celulares]))?.includes('productos'));
await q(`select pkg_admin.eliminar_categoria($1)`, [bici.id]);
await q(`select pkg_admin.quitar_atributo_categoria($1, $2)`, [deportes, rodado]);
await q(`select pkg_admin.eliminar_atributo($1)`, [rodado]);
check('Una categoría y un atributo sin uso se borran',
  !(await uno(`select 1 from public.categorias where id = $1`, [bici.id])) &&
  !(await uno(`select 1 from public.atributos where id = $1`, [rodado])));
check('Moderación no edita el territorio',
  (await falla(`select pkg_admin.guardar_localidad($1, null, 'Zonda', 'zonda')`,
    [(await uno(`select provincia_id from public.localidades where id = $1`, [capital])).provincia_id]))?.includes('Solo logística'));

await comoServidorDb();
const fichaCat = (await uno(`select pkg_admin.categoria($1) r`, [celulares])).r;
const fichaMujer = (await uno(`select pkg_admin.categoria($1) r`, [await cat('/ropa/ropa-de-mujer/')])).r;
check('La ficha de la categoría trae su camino, sus productos y los atributos propios en uso',
  fichaCat.camino[0]?.id === tecnologia && fichaCat.productos.publicados >= 1 &&
  fichaMujer.atributos.some((a) => a.nombre === 'Talle' && a.define_variante && a.desde === null && a.enUso >= 1));
check('La ficha de una subcategoría muestra de dónde hereda cada atributo',
  fichaMujer.atributos.some((a) => a.nombre === 'Material' && a.desde?.nombre === 'Indumentaria y calzado'));
const arbol = (await uno(`select pkg_admin.categorias() r`)).r;
check('El listado de categorías suma los productos de las subcategorías',
  arbol.find((c) => c.id === tecnologia).productos.total >= arbol.find((c) => c.id === celulares).productos.total &&
  arbol.find((c) => c.id === deportes).comision_pct == 5);
check('Los cambios de categorías quedan en el registro de actividad',
  (await uno(`select count(*)::int n from public.auditoria where entidad = 'categorias' and actor_id = $1`, [mora])).n > 0);

// Territorio.
const mendoza = (await uno(`select id from public.provincias where slug = 'mendoza'`)).id;
await como(logi);
check('No se repite una provincia',
  (await falla(`select pkg_admin.guardar_provincia(null, 'Mendoza', 'mendoza')`))?.includes('Ya existe'));
check('Una provincia sin localidades activas no se activa',
  (await falla(`select pkg_admin.activar_provincia($1, true)`, [mendoza]))?.includes('al menos una localidad'));
const godoy = (await uno(`select pkg_admin.guardar_localidad($1, null, 'Godoy Cruz', 'godoy-cruz') r`, [mendoza])).r.id;
check('No se repite una localidad en la misma provincia',
  (await falla(`select pkg_admin.guardar_localidad($1, null, 'Godoy Cruz', 'godoy-cruz')`, [mendoza]))?.includes('Ya existe'));
await como(diego);
check('No se carga una dirección en una provincia donde todavía no estamos',
  (await falla(`insert into public.direcciones (usuario_id, calle, numero, localidad_id) values ($1, 'San Martín', '100', $2)`,
    [diego, godoy]))?.includes('Todavía no estamos'));
await como(logi);
await q(`select pkg_admin.activar_provincia($1, true)`, [mendoza]);
check('Logística cobra el envío y valida el costo',
  (await uno(`select pkg_admin.tarifa_envio($1, 4200, true) r`, [godoy])).r.costo == 4200 &&
  (await falla(`select pkg_admin.tarifa_envio($1, -1, true)`, [godoy]))?.includes('Ingresá un costo'));
await como(diego);
await q(`insert into public.direcciones (usuario_id, calle, numero, localidad_id) values ($1, 'San Martín', '100', $2)`, [diego, godoy]);
check('Activada la provincia, ya se cargan direcciones ahí',
  (await q(`select 1 from public.direcciones where localidad_id = $1`, [godoy])).length === 1);

await como(logi);
await q(`select pkg_admin.activar_localidad($1, false)`, [capital]);
await como(diego);
check('Al desactivar una localidad no se ofrece más, pero las direcciones de ahí siguen',
  !(await uno(`select pkg_ubicacion.localidades() l`)).l.some((l) => l.id === capital) &&
  (await q(`select 1 from public.direcciones d join public.localidades l on l.id = d.localidad_id
            where d.id = $1`, [dir])).length === 1);
await como(logi);
await q(`select pkg_admin.activar_localidad($1, true)`, [capital]);
check('No se borra una localidad con tiendas o direcciones',
  (await falla(`select pkg_admin.eliminar_localidad($1)`, [capital]))?.includes('desactivala'));
const maipu = (await uno(`select pkg_admin.guardar_localidad($1, null, 'Maipú', 'maipu') r`, [mendoza])).r.id;
await q(`select pkg_admin.eliminar_localidad($1)`, [maipu]);
check('Una localidad cargada por error se borra', !(await uno(`select 1 from public.localidades where id = $1`, [maipu])));

await comoServidorDb();
const terr = (await uno(`select pkg_admin.territorio($1) r`, [mendoza])).r;
check('El territorio muestra cada localidad con su tarifa y sus direcciones',
  terr.provincia.id === mendoza &&
  terr.localidades.some((l) => l.id === godoy && l.tarifa?.costo == 4200 && l.direcciones === 1) &&
  terr.provincias.find((p) => p.nombre === 'San Juan').tiendas >= 2);
await como(diego);
check('El territorio no se puede leer desde el navegador',
  (await falla(`select pkg_admin.territorio()`))?.includes('permission denied'));

// ---------------------------------------------------------------------------
log('\n16. Usuarios: bloqueo de cuentas');
await comoServidorDb();
const sofi = await crearUsuario('sofi@plataforma.com', 'Sofía');   // soporte
const fede = await crearUsuario('fede@plataforma.com', 'Federico'); // finanzas
const vale = await crearUsuario('vale@tienda-v.com', 'Valeria');    // vendedora
await q(`insert into public.roles_plataforma (usuario_id, rol) values ($1, 'soporte'), ($2, 'finanzas')`, [sofi, fede]);
await como(vale);
const V = (await uno(`insert into public.tiendas (nombre, slug, cuit, localidad_id, direccion, rubro_id)
  values ('Tienda V', 'tienda-v', '27-33333333-3', $1, 'Rivadavia 300', $2) returning id`, [capital, moda])).id;
const V2 = (await uno(`insert into public.tiendas (nombre, slug, cuit, localidad_id, direccion, rubro_id)
  values ('Tienda V2', 'tienda-v2', '27-33333333-3', $1, 'Rivadavia 302', $2) returning id`, [capital, moda])).id;
await comoServidorDb();
await q(`insert into public.cuentas_mp_tienda (tienda_id, mp_user_id, access_token_cifrado, refresh_token_cifrado, expira_en)
  values ($1, 'mp-v', 'x', 'x', now() + interval '180 days')`, [V]);
const suscV = (await uno(`insert into public.suscripciones (tienda_id, plan_id, estado, fin_periodo)
  values ($1, $2, 'activa', now() + interval '3 days') returning id`, [V, await plan('Premium')])).id;
await q(`update public.tiendas set estado = 'activa' where id = $1`, [V]);

const vendedores = (await uno(`select pkg_admin.usuarios('vendedores', 'VALE@') r`)).r;
check('El listado de usuarios filtra vendedores y busca por correo',
  vendedores.total === 1 && vendedores.items[0].id === vale && vendedores.items[0].tiendas === 2 &&
  vendedores.conteos.equipo >= 4);

await como(sofi);
check('Nadie se bloquea a sí mismo',
  (await falla(`select pkg_admin.bloquear_usuario($1, 'Prueba de bloqueo')`, [sofi]))?.includes('tu propia cuenta'));
check('El superadmin no se puede bloquear',
  (await falla(`select pkg_admin.bloquear_usuario($1, 'Prueba de bloqueo')`, [admin]))?.includes('superadmin no se puede'));
check('A alguien del equipo solo lo bloquea el superadmin',
  (await falla(`select pkg_admin.bloquear_usuario($1, 'Prueba de bloqueo')`, [mora]))?.includes('solo lo bloquea el superadmin'));
check('Bloquear pide un motivo',
  (await falla(`select pkg_admin.bloquear_usuario($1, 'no')`, [vale]))?.includes('motivo'));
const bloqueo = (await uno(`select pkg_admin.bloquear_usuario($1, 'Fraude reiterado con compradores') r`, [vale])).r;
check('Soporte bloquea la cuenta y se suspenden sus tiendas pendientes y activas', bloqueo.tiendasSuspendidas === 2);
check('Bloquear dos veces avisa que ya está bloqueada',
  (await falla(`select pkg_admin.bloquear_usuario($1, 'Fraude reiterado')`, [vale]))?.includes('ya está bloqueada'));

await comoServidorDb();
const tiendasVale = await q(`select estado, motivo_estado from public.tiendas where propietario_id = $1`, [vale]);
check('Las tiendas quedan suspendidas con un motivo que ve la dueña',
  tiendasVale.every((t) => t.estado === 'suspendida' && t.motivo_estado.includes('bloqueada')));
check('Una cuenta bloqueada no puede iniciar sesión',
  (await uno(`select pkg_auth.ingreso($1) m`, [vale])).m === 'Fraude reiterado con compradores' &&
  (await uno(`select ultimo_ingreso from public.perfiles where id = $1`, [vale])).ultimo_ingreso === null);

await como(vale);
await q(`update public.perfiles set ultimo_ingreso = now(), nombre = 'Vale' where id = $1`, [vale]);
check('Nadie se escribe su propio último ingreso',
  (await uno(`select ultimo_ingreso, nombre from public.perfiles where id = $1`, [vale])).ultimo_ingreso === null);

// Mientras está bloqueada, moderación archiva una de las tiendas: esa no vuelve.
await como(mora);
await q(`select pkg_admin.cambiar_estado_tienda($1, 'archivada', 'Tienda duplicada')`, [V2]);
await como(diego);
check('Un cliente no puede bloquear cuentas',
  (await falla(`select pkg_admin.bloquear_usuario($1, 'Me cae mal')`, [vale]))?.includes('Solo soporte'));
await como(sofi);
const desbloqueo = (await uno(`select pkg_admin.desbloquear_usuario($1, 'Presentó la documentación') r`, [vale])).r;
await comoServidorDb();
check('Al desbloquear, las tiendas vuelven a su estado salvo las que moderación cambió',
  desbloqueo.tiendasRestauradas === 1 &&
  (await uno(`select estado, motivo_estado from public.tiendas where id = $1`, [V])).estado === 'activa' &&
  (await uno(`select estado from public.tiendas where id = $1`, [V2])).estado === 'archivada');
check('Desbloqueada, puede entrar y queda anotado su último ingreso',
  (await uno(`select pkg_auth.ingreso($1) m`, [vale])).m === null &&
  (await uno(`select ultimo_ingreso from public.perfiles where id = $1`, [vale])).ultimo_ingreso !== null);
const fichaVale = (await uno(`select pkg_admin.usuario($1) r`, [vale])).r;
check('La ficha muestra el historial de bloqueos con quién bloqueó y desbloqueó',
  fichaVale.bloqueo === null && fichaVale.tiendas.length === 2 &&
  fichaVale.historialBloqueos[0]?.bloqueadoPor === 'Sofía' &&
  fichaVale.historialBloqueos[0]?.nota === 'Presentó la documentación');
check('El bloqueo queda en el registro de actividad',
  (await uno(`select count(*)::int n from public.auditoria where entidad = 'bloqueos_cuenta' and actor_id = $1`, [sofi])).n === 2);
await como(admin);
await q(`select pkg_admin.bloquear_usuario($1, 'Prueba del superadmin')`, [mora]);
await q(`select pkg_admin.desbloquear_usuario($1)`, [mora]);
check('El superadmin sí puede bloquear a alguien del equipo',
  (await uno(`select count(*)::int n from public.bloqueos_cuenta where usuario_id = $1`, [mora])).n === 1);
await como(diego);
check('El listado de usuarios no se puede llamar desde el navegador',
  (await falla(`select pkg_admin.usuarios()`))?.includes('permission denied'));

// ---------------------------------------------------------------------------
log('\n17. Pedidos y reembolsos');
{
await como(diego);
await q(`delete from public.carrito_items where carrito_id = $1`, [carrito]);
const vCargador = (await uno(`select id from public.variantes where producto_id = $1`, [cargador])).id;
await q(`insert into public.carrito_items (carrito_id, variante_id, cantidad) values ($1, $2, 1), ($1, $3, 1)`,
  [carrito, vCargador, vFunda]);
const pedido3 = (await uno(`select public.crear_pedido($1) id`, [dir])).id;
await servidor();
const ped3 = await uno(`select numero, total, costo_envio from public.pedidos where id = $1`, [pedido3]);
await q(`select * from public.confirmar_pago($1, 'mp-17', $2)`, [pedido3, ped3.total]);
const pt3 = (await uno(`select id, total from public.pedidos_tienda where pedido_id = $1`, [pedido3]));
const stockCargador = (await uno(`select stock from public.variantes where id = $1`, [vCargador])).stock;

await comoServidorDb();
const listaPedidos = (await uno(`select pkg_admin.pedidos('en_curso', $1) r`, ['#' + ped3.numero])).r;
check('La vista global de pedidos busca por número y muestra cada tienda',
  listaPedidos.total === 1 && listaPedidos.items[0].partes[0].tienda === 'Tienda B' &&
  listaPedidos.items[0].comprador.email === 'diego@gmail.com');
check('Busca también por el nombre de la tienda',
  (await uno(`select pkg_admin.pedidos('todos', 'tienda b') r`)).r.items.some((p) => p.id === pedido3));
const fichaSoporte = (await uno(`select pkg_admin.pedido($1, $2) r`, [pedido3, sofi])).r;
const fichaFinanzas = (await uno(`select pkg_admin.pedido($1, $2) r`, [pedido3, fede])).r;
check('Los pagos del pedido solo los ve finanzas',
  fichaSoporte.pagos === null && fichaFinanzas.pagos.length === 1 &&
  fichaSoporte.permisos.cancelar === true && fichaFinanzas.permisos.cancelar === false);

await como(fede);
check('Finanzas no cancela pedidos',
  (await falla(`select pkg_admin.cancelar_parte($1, 'El comprador lo pidió')`, [pt3.id]))?.includes('Solo soporte o logística'));
await q(`select pkg_admin.reembolsar($1, 10000, 'Llegó con la caja rota')`, [pt3.id]);
check('Finanzas devuelve dinero a mano y el pedido queda "reembolsado en parte"',
  (await uno(`select estado_pago from public.pedidos where id = $1`, [pedido3])).estado_pago === 'reembolsado_parcial');
check('No se devuelve más de lo que se pagó por la parte',
  (await falla(`select pkg_admin.reembolsar($1, 25000, 'Otro reclamo más')`, [pt3.id]))?.includes('supera lo que queda'));
await como(diego);
check('Un cliente no puede crearse un reembolso',
  (await falla(`select pkg_admin.reembolsar($1, 1, 'Me lo devuelvo')`, [pt3.id]))?.includes('Solo finanzas') &&
  !!(await falla(`insert into public.reembolsos (pedido_tienda_id, monto, motivo) values ($1, 1, 'x')`, [pt3.id])));
check('El comprador recibe el aviso del reembolso',
  (await q(`select 1 from public.notificaciones where tipo = 'reembolso' and datos ->> 'pedido' = $1`, [String(ped3.numero)])).length === 1);

await como(sofi);
check('Cancelar pide un motivo',
  (await falla(`select pkg_admin.cancelar_parte($1, 'no')`, [pt3.id]))?.includes('motivo'));
await q(`select pkg_admin.cancelar_parte($1, 'El comprador pidió cancelar')`, [pt3.id]);
check('Cancelar dos veces avisa que ya está cancelada',
  (await falla(`select pkg_admin.cancelar_parte($1, 'Otra vez lo mismo')`, [pt3.id]))?.includes('ya está cancelada'));
await comoServidorDb();
const devoluciones = await q(`select monto, estado, es_envio from public.reembolsos where pedido_tienda_id = $1 order by creado_en`, [pt3.id]);
check('Al cancelar se devuelve solo lo que faltaba y el envío, pendientes para finanzas',
  devoluciones.length === 3 &&
  devoluciones.some((r) => !r.es_envio && r.estado === 'pendiente' && Number(r.monto) === Number(pt3.total) - 10000) &&
  devoluciones.some((r) => r.es_envio && Number(r.monto) === Number(ped3.costo_envio)));
check('Vuelve el stock de lo cancelado',
  (await uno(`select stock from public.variantes where id = $1`, [vCargador])).stock === stockCargador + 1);
const fichaCancelada = (await uno(`select pkg_admin.pedido($1, $2) r`, [pedido3, fede])).r;
check('El historial muestra quién canceló y por qué',
  fichaCancelada.partes[0].historial.some((h) => h.estado === 'cancelado' && h.actor === 'Sofía' &&
    h.nota === 'El comprador pidió cancelar') && fichaCancelada.partes[0].reembolsable == 0);
check('La vista "con reembolsos pendientes" muestra el pedido',
  (await uno(`select pkg_admin.pedidos('reembolsos') r`)).r.items.some((p) => p.id === pedido3));

const pendientes = fichaCancelada.reembolsos.filter((r) => r.estado === 'pendiente');
await como(fede);
check('Rechazar un reembolso pide una nota',
  (await falla(`select pkg_admin.procesar_reembolso($1, false)`, [pendientes[0].id]))?.includes('por qué se rechaza'));
for (const r of pendientes) await q(`select pkg_admin.procesar_reembolso($1, true)`, [r.id]);
check('Procesar dos veces avisa que ya se procesó',
  (await falla(`select pkg_admin.procesar_reembolso($1, true)`, [pendientes[0].id]))?.includes('ya fue procesado'));
await comoServidorDb();
check('Con todo devuelto, el pedido queda "reembolsado" y cada devolución tiene su referencia',
  (await uno(`select estado_pago from public.pedidos where id = $1`, [pedido3])).estado_pago === 'reembolsado' &&
  (await q(`select 1 from public.reembolsos where pedido_tienda_id = $1 and mp_refund_id like 'SIM-REF-%'
            and procesado_por = $2`, [pt3.id, fede])).length === 3);
await como(diego);
check('La vista global de pedidos no se puede llamar desde el navegador',
  (await falla(`select pkg_admin.pedidos()`))?.includes('permission denied'));
}

// ---------------------------------------------------------------------------
log('\n18. Planes y suscripciones');
const plan1 = await plan('Premium');
const gratis = await plan('Starter');
await como(sofi);
check('Soporte no edita planes',
  (await falla(`select pkg_admin.guardar_plan($1, 'Premium', 12000, 100, 3)`, [plan1]))?.includes('Solo finanzas'));
await como(fede);
check('El plan gratis no tiene precio ni se desactiva',
  (await falla(`select pkg_admin.guardar_plan($1, 'Starter', 500, 10, 0)`, [gratis]))?.includes('no tiene precio') &&
  (await falla(`select pkg_admin.guardar_plan($1, 'Starter', 0, 10, 0, false)`, [gratis]))?.includes('no se puede desactivar'));
check('Un plan nuevo necesita precio y un nombre que no exista',
  (await falla(`select pkg_admin.guardar_plan(null, 'Plan Pro', 0, null, null)`))?.includes('mayor a cero') &&
  (await falla(`select pkg_admin.guardar_plan(null, 'premium', 9000, null, null)`))?.includes('Ya hay un plan'));
const pro = (await uno(`select pkg_admin.guardar_plan(null, 'Plan Pro', 25000, null, null) r`)).r;
check('Finanzas crea un plan nuevo al final de la lista', pro.orden >= 4 && pro.es_gratis === false);
await q(`select pkg_admin.ordenar_plan($1, 'subir')`, [pro.id]);

// Tienda V (Premium) con 3 productos publicados; el plan baja a 2.
await comoServidorDb();
for (let i = 1; i <= 3; i++) {
  const p = (await uno(`insert into public.productos (tienda_id, categoria_id, nombre, slug) values ($1, $2, $3, $4) returning id`,
    [V, await cat('/hogar-y-decoracion/cocina/'), `Mate ${i}`, `mate-${i}`])).id;
  await q(`insert into public.variantes (producto_id, precio, stock) values ($1, 8000, 4)`, [p]);
  await q(`update public.productos set estado = 'publicado' where id = $1`, [p]);
}
await como(fede);
const editado = (await uno(`select pkg_admin.guardar_plan($1, 'Premium', 12000, 2, 3) r`, [plan1])).r;
check('Un plan con precio no vuelve a cero',
  (await falla(`select pkg_admin.guardar_plan($1, 'Premium', 0, 2, 3)`, [plan1]))?.includes('mayor a cero'));
await comoServidorDb();
check('Bajar el límite de un plan pausa en el acto lo que sobra en sus tiendas',
  editado.efectos?.tiendas === 1 && editado.efectos?.productos === 1 &&
  (await uno(`select count(*)::int n from public.productos where tienda_id = $1 and motivo_pausa = 'limite_plan'`, [V])).n === 1,
  JSON.stringify(editado.efectos));
const planes = (await uno(`select pkg_admin.planes() r`)).r;
check('Los planes muestran cuántas tiendas los usan y cuánto facturan',
  planes.find((p) => p.id === plan1).tiendas >= 1 && planes.find((p) => p.id === plan1).ingresoMensual >= 12000 &&
  planes.findIndex((p) => p.id === pro.id) < planes.findIndex((p) => p.nombre === 'Gold'));

const porVencer = (await uno(`select pkg_admin.suscripciones('por_vencer', null, 'tienda v') r`)).r;
check('La vista "por vencer" muestra la suscripción que vence en 3 días',
  porVencer.items.some((s) => s.id === suscV && s.duenio.email === 'vale@tienda-v.com') && porVencer.conteos.por_vencer >= 1);

await como(fede);
const finAntes = new Date((await uno(`select fin_periodo from public.suscripciones where id = $1`, [suscV])).fin_periodo);
check('Extender pide días válidos y un motivo',
  (await falla(`select pkg_admin.extender_suscripcion($1, 0, 'Compensación')`, [suscV]))?.includes('entre 1 y 90') &&
  (await falla(`select pkg_admin.extender_suscripcion($1, 10, 'no')`, [suscV]))?.includes('motivo'));
await q(`select pkg_admin.extender_suscripcion($1, 10, 'Compensación por la caída del sitio')`, [suscV]);
const finExtendido = new Date((await uno(`select fin_periodo from public.suscripciones where id = $1`, [suscV])).fin_periodo);
check('Extender suma los días al vencimiento', Math.round((finExtendido - finAntes) / 86400000) === 10);
const pago = (await uno(`select pkg_admin.registrar_pago_suscripcion($1, 'TRF-001') r`, [suscV])).r;
check('Registrar un pago cobra el precio del plan y corre el vencimiento un mes',
  Number(pago.monto) === 12000 && new Date(pago.fin_periodo) > finExtendido);
check('Una referencia de pago no se registra dos veces',
  (await falla(`select pkg_admin.registrar_pago_suscripcion($1, 'TRF-001')`, [suscV]))?.includes('ya está registrada'));
const suscB = (await uno(`select id from public.suscripciones where tienda_id = $1 and estado = 'activa'`, [B])).id;
check('El plan gratis no se cancela ni se extiende',
  (await falla(`select pkg_admin.cancelar_suscripcion($1, 'Prueba de cancelación')`, [suscB]))?.includes('no se cancela') &&
  (await falla(`select pkg_admin.extender_suscripcion($1, 5, 'Prueba de extensión')`, [suscB]))?.includes('no vence'));
await q(`select pkg_admin.cancelar_suscripcion($1, 'Pidió la baja por correo')`, [suscV]);
await comoServidorDb();
check('Cancelada la suscripción, la tienda vence',
  (await uno(`select estado from public.tiendas where id = $1`, [V])).estado === 'vencida');
const fichaSusc = (await uno(`select pkg_admin.suscripcion($1) r`, [suscV])).r;
check('La ficha de la suscripción muestra pagos, uso y quién hizo cada cambio',
  fichaSusc.pagos.length === 1 && fichaSusc.uso.pausadosPorLimite === 1 &&
  fichaSusc.historial.some((h) => h.nota === 'Compensación por la caída del sitio' && h.actor === 'Federico') &&
  fichaSusc.historial.some((h) => h.estado === 'cancelada' && h.nota === 'Pidió la baja por correo'));
await como(fede);
check('Una suscripción cancelada ya no se extiende',
  (await falla(`select pkg_admin.extender_suscripcion($1, 5, 'Prueba de extensión')`, [suscV]))?.includes('Solo se extiende'));
await comoServidorDb();
check('El tablero suma cuentas bloqueadas (soporte) y suscripciones por vencer (finanzas)',
  'bloqueados' in (await uno(`select pkg_admin.tablero($1) t`, [sofi])).t.usuarios &&
  'porVencer' in (await uno(`select pkg_admin.tablero($1) t`, [fede])).t.suscripciones);
await como(diego);
check('Las suscripciones no se pueden leer desde el navegador',
  (await falla(`select pkg_admin.suscripciones()`))?.includes('permission denied'));

// ---------------------------------------------------------------------------
log('\n19. Compra solo con retiro en el local');
await comoServidorDb();
await q(`update public.configuracion set valor = 'true' where clave = 'retiro_en_local_habilitado'`);
const paraRetirar = await uno(`
  select v.id, v.tienda_id from public.variantes v
  join public.productos p on p.id = v.producto_id
  join public.tiendas t on t.id = v.tienda_id
  where p.estado = 'publicado' and t.estado = 'activa' and v.activa and public.stock_disponible(v.id) > 0
  limit 1`);
await como(diego);
await q(`delete from public.carrito_items where carrito_id = $1`, [carrito]);
await q(`insert into public.carrito_items (carrito_id, variante_id, cantidad) values ($1, $2, 1)`, [carrito, paraRetirar.id]);
const pedidoRetiro = (await uno(`select public.crear_pedido(null, array[$1]::uuid[]) id`, [paraRetirar.tienda_id])).id;
const pr = await uno(`select p.costo_envio, p.direccion_envio, pt.modalidad from public.pedidos p
  join public.pedidos_tienda pt on pt.pedido_id = p.id where p.id = $1`, [pedidoRetiro]);
check('Se compra sin dirección cuando todo se retira en el local',
  Number(pr.costo_envio) === 0 && pr.direccion_envio === null && pr.modalidad === 'retiro_en_local', JSON.stringify(pr));

// ---------------------------------------------------------------------------
log('\n20. El equipo de la plataforma también compra');
await comoServidorDb();
const productoRetiro = (await uno(`select producto_id from public.variantes where id = $1`, [paraRetirar.id])).producto_id;
const carritoAdmin = (await uno(`insert into public.carritos (usuario_id) values ($1) returning id`, [admin])).id;
const errCarritoEquipo = await falla(`insert into public.carrito_items (carrito_id, variante_id, cantidad) values ($1, $2, 1)`,
  [carritoAdmin, paraRetirar.id]);
check('El equipo carga el carrito como cualquier cuenta', !errCarritoEquipo, errCarritoEquipo ?? '');
const errFavoritoEquipo = await falla(`insert into public.favoritos (usuario_id, producto_id) values ($1, $2)`, [mora, productoRetiro]);
check('El equipo guarda favoritos', !errFavoritoEquipo, errFavoritoEquipo ?? '');

// ---------------------------------------------------------------------------
log('\n21. Los roles de las tiendas los define la plataforma');
await como(ana);
check('El dueño no crea roles para su tienda',
  !!(await falla(`insert into public.roles_tienda (tienda_id, nombre) values ($1, 'Caja')`, [A])) &&
  (await falla(`select pkg_equipo.guardar_rol($1, null, 'Caja', array['pedidos.ver'])`, [A]))?.includes('does not exist'));
check('El dueño no edita los permisos de un rol predefinido',
  !!(await falla(`insert into public.roles_permisos (rol_id, permiso_codigo) values ($1, 'ventas.ver')`, [rolCatalogo])));
await como(fede);
check('Solo el superadmin define los roles de las tiendas',
  (await falla(`select pkg_admin.guardar_rol_tienda(null, 'Depósito', array['stock.editar'])`))?.includes('Solo el superadmin'));
await como(admin);
const rolDeposito = (await uno(`select pkg_admin.guardar_rol_tienda(null, 'Depósito', array['productos.ver', 'stock.editar']) r`)).r;
check('Un rol con un nombre que ya existe no se crea',
  (await falla(`select pkg_admin.guardar_rol_tienda(null, 'depósito', array['stock.editar'])`))?.includes('Ya hay un rol'));
await como(ana);
const rolesDeA = (await uno(`select pkg_equipo.equipo($1) r`, [A])).r.roles;
check('El dueño ve el rol nuevo para asignarlo',
  rolesDeA.some((r) => r.id === rolDeposito && !r.propio && r.permisos.length === 2));
await comoServidorDb();
const invDeposito = (await uno(`insert into public.invitaciones (tienda_id, email, rol_id, token_hash)
  values ($1, 'deposito@gmail.com', $2, 'hash-deposito') returning id`, [A, rolDeposito])).id;
await como(admin);
check('Un rol con invitaciones pendientes no se borra',
  (await falla(`select pkg_admin.borrar_rol_tienda($1)`, [rolDeposito]))?.includes('no se puede borrar'));
await comoServidorDb();
await q(`update public.invitaciones set estado = 'anulada' where id = $1`, [invDeposito]);
await como(admin);
await q(`select pkg_admin.borrar_rol_tienda($1)`, [rolDeposito]);
await comoServidorDb();
check('Al borrar un rol, las invitaciones viejas pasan a otro rol predefinido',
  (await uno(`select r.tienda_id is null and r.id <> $2 ok from public.invitaciones i
              join public.roles_tienda r on r.id = i.rol_id where i.id = $1`, [invDeposito, rolDeposito])).ok === true);
check('El superadmin ve los roles con su uso en las tiendas',
  (await uno(`select pkg_admin.roles_tienda() r`)).r.roles.some((r) => r.id === rolCatalogo && r.personas >= 1));
await como(ana);
check('La lista de roles de la plataforma no se lee desde el navegador',
  (await falla(`select pkg_admin.roles_tienda()`))?.includes('permission denied'));

// ---------------------------------------------------------------------------
log('\n22. Seguir tiendas');
await comoServidorDb();
const seguida = await uno(`select id, slug, propietario_id from public.tiendas where id = $1`, [paraRetirar.tienda_id]);
await como(diego);
const alSeguir = (await uno(`select pkg_seguidos.seguir($1) r`, [seguida.id])).r;
await q(`select pkg_seguidos.seguir($1)`, [seguida.id]);
check('El cliente sigue una tienda (seguirla dos veces no la duplica)',
  alSeguir.ids.includes(seguida.id) && alSeguir.seguidores === 1 &&
  (await uno(`select pkg_seguidos.ids() r`)).r.length === 1);
check('No se sigue una tienda que no está disponible',
  (await falla(`select pkg_seguidos.seguir(gen_random_uuid())`))?.includes('no está disponible'));
const sugeridas = (await uno(`select pkg_seguidos.sugerencias() r`)).r;
check('Las sugerencias traen las tiendas seguidas y sus productos',
  sugeridas.tiendas.some((t) => t.id === seguida.id) && sugeridas.productos.length > 0 &&
  sugeridas.productos.every((p) => p.tienda.slug === seguida.slug), JSON.stringify(sugeridas.tiendas));
await como(seguida.propietario_id);
check('El dueño no sigue su propia tienda',
  (await falla(`select pkg_seguidos.seguir($1)`, [seguida.id]))?.includes('Es tu tienda'));
const enPanel = (await uno(`select pkg_tiendas.seguidores($1) r`, [seguida.id])).r;
check('El dueño ve en su panel cuántos lo siguen y cuántos se sumaron esta semana',
  enPanel.total === 1 && enPanel.semana === 1, JSON.stringify(enPanel));
await como(diego);
check('Quien no es de la tienda no ve sus seguidores desde el panel',
  (await falla(`select pkg_tiendas.seguidores($1)`, [seguida.id]))?.includes('no tenés acceso'));
await como(carla);
check('Nadie ve a quién sigue otra persona',
  (await uno(`select count(*)::int n from public.seguidores_tienda`)).n === 0);
await como(null);
check('La página pública muestra cuántos siguen a la tienda',
  (await uno(`select pkg_catalogo.tienda($1) r`, [seguida.slug])).r.seguidores === 1);
check('Sin sesión no se sigue una tienda',
  (await falla(`select pkg_seguidos.seguir($1)`, [seguida.id]))?.includes('permission denied'));
await como(diego);
const alDejar = (await uno(`select pkg_seguidos.dejar($1) r`, [seguida.id])).r;
check('El cliente deja de seguir la tienda', !alDejar.ids.includes(seguida.id) && alDejar.seguidores === 0);

// ---------------------------------------------------------------------------
log('\n23. Rubros');
await como(null);
const rubrosLista = (await uno(`select pkg_catalogo.rubros() r`)).r;
const alquileres = rubrosLista.find((r) => r.slug === 'alquileres');
const inmuebles = alquileres?.subrubros.find((s) => s.slug === 'inmuebles');
const vehiculos = alquileres?.subrubros.find((s) => s.slug === 'vehiculos');
check('La lista estándar tiene 17 rubros y Alquileres tres niveles',
  rubrosLista.length === 17 && alquileres.subrubros.length === 10 && inmuebles.especialidades.length === 9 &&
  rubrosLista.find((r) => r.slug === 'mascotas').subrubros.every((s) => s.especialidades.length === 0));
check('Los rubros principales traen su descripción',
  rubrosLista.every((r) => r.descripcion) &&
  rubrosLista.find((r) => r.slug === 'hogar-y-decoracion').descripcion === 'Deco, muebles y bazar');
check('En Juguetes y niños, Juguetes va antes que Juegos de mesa',
  rubrosLista.find((r) => r.slug === 'juguetes-y-ninos').subrubros.slice(0, 2).map((s) => s.nombre).join('|') ===
    'Juguetes|Juegos de mesa');
const id = (lista, nombre) => lista.find((x) => x.nombre === nombre).id;
const modaArbol = rubrosLista.find((r) => r.slug === 'indumentaria-y-moda');

await como(ana);
await q(`select pkg_tiendas.actualizar($1, $2)`, [A, {
  rubro_id: alquileres.id, subrubro_id: inmuebles.id,
  especialidades: [id(inmuebles.especialidades, 'Casas'), id(inmuebles.especialidades, 'Departamentos')],
}]);
let detalleA = (await uno(`select pkg_tiendas.detalle($1) d`, [A])).d;check('La dueña elige rubro, subrubro y especialidades',
  detalleA.rubro.slug === 'alquileres' && detalleA.subrubro.nombre === 'Inmuebles' &&
  detalleA.especialidades.length === 2, JSON.stringify(detalleA.especialidades));
check('Las especialidades tienen que ser del subrubro elegido',
  (await falla(`select pkg_tiendas.actualizar($1, $2)`,
    [A, { especialidades: [id(vehiculos.especialidades, 'Autos')] }]))?.includes('del subrubro elegido'));
check('El subrubro tiene que ser del rubro',
  (await falla(`select pkg_tiendas.actualizar($1, $2)`,
    [A, { subrubro_id: id(modaArbol.subrubros, 'Calzado') }]))?.includes('no corresponde'));
check('Una vez cargado, el rubro no se puede dejar vacío',
  (await falla(`select pkg_tiendas.actualizar($1, $2)`, [A, { rubro_id: null }]))?.includes('rubro principal'));
await q(`select pkg_tiendas.actualizar($1, $2)`, [A, { subrubro_id: vehiculos.id }]);
detalleA = (await uno(`select pkg_tiendas.detalle($1) d`, [A])).d;check('Al cambiar de subrubro se van las especialidades del anterior',
  detalleA.subrubro.nombre === 'Vehículos' && detalleA.especialidades.length === 0);
await q(`select pkg_tiendas.actualizar($1, $2)`, [A, { rubro_id: modaArbol.id }]);
detalleA = (await uno(`select pkg_tiendas.detalle($1) d`, [A])).d;
check('Al cambiar de rubro sin elegir subrubro, el subrubro queda vacío',
  detalleA.rubro.slug === 'indumentaria-y-moda' && detalleA.subrubro === null);
const calzado = id(modaArbol.subrubros, 'Calzado');
await q(`select pkg_tiendas.actualizar($1, $2)`, [A, { subrubro_id: calzado }]);
await como(carla);
check('Sin permiso de configuración no se cambia el rubro',
  !!(await falla(`select pkg_tiendas.actualizar($1, $2)`, [A, { rubro_id: alquileres.id }])));
await comoServidorDb();
check('La página pública muestra el rubro declarado',
  (await uno(`select pkg_catalogo.rubro($1) r`, [A])).r.nombre === 'Indumentaria y moda');

await como(admin);
const nuevo = (await uno(`select pkg_admin.guardar_rubro(null, 'Drones', 'drones', $1) r`, [alquileres.id])).r;
check('El superadmin agrega un subrubro', nuevo.nivel === 2 && nuevo.activo);
check('No se repite un nombre en el mismo lugar',
  (await falla(`select pkg_admin.guardar_rubro(null, 'drones', 'drones-2', $1)`, [alquileres.id]))?.includes('Ya existe'));
check('Un rubro no lleva un cuarto nivel',
  (await falla(`select pkg_admin.guardar_rubro(null, 'Chalets', 'chalets', $1)`,
    [id(inmuebles.especialidades, 'Casas')]))?.includes('otro nivel'));
await q(`select pkg_admin.describir_rubro($1, '  Moda,   calzado y más ')`, [modaArbol.id]);
check('El superadmin cambia la descripción de un rubro',
  (await uno(`select pkg_catalogo.rubros() r`)).r.find((r) => r.id === modaArbol.id).descripcion === 'Moda, calzado y más');
await q(`select pkg_admin.describir_rubro($1, '')`, [modaArbol.id]);
check('Vacía, la descripción se quita',
  (await uno(`select pkg_catalogo.rubros() r`)).r.find((r) => r.id === modaArbol.id).descripcion === null);
check('Los subrubros no llevan descripción',
  (await falla(`select pkg_admin.describir_rubro($1, 'Zapatos')`, [calzado]))?.includes('rubros principales'));
check('La descripción tiene hasta 120 caracteres',
  (await falla(`select pkg_admin.describir_rubro($1, $2)`, [modaArbol.id, 'x'.repeat(121)]))?.includes('entre 2 y 120'));
await q(`select pkg_admin.ordenar_rubro($1, 'subir')`, [nuevo.id]);
check('Se reordena entre sus hermanos',
  (await uno(`select pkg_catalogo.rubros() r`)).r.find((r) => r.slug === 'alquileres')
    .subrubros.at(-2).nombre === 'Drones');
const baja = (await uno(`select pkg_admin.activar_rubro($1, false) r`, [alquileres.id])).r;
check('Desactivar un rubro desactiva todo lo que tiene adentro', baja.rubros > 50, JSON.stringify(baja));
check('No se activa un subrubro si su rubro está inactivo',
  (await falla(`select pkg_admin.activar_rubro($1, true)`, [inmuebles.id]))?.includes('Primero activá'));
await como(ana);
check('Un rubro inactivo no se puede elegir',
  (await falla(`select pkg_tiendas.actualizar($1, $2)`, [A, { rubro_id: alquileres.id }]))?.includes('ya no está disponible'));
check('El rubro inactivo no aparece en la lista para elegir',
  !(await uno(`select pkg_catalogo.rubros() r`)).r.some((r) => r.slug === 'alquileres'));
check('Solo el superadmin edita los rubros',
  (await falla(`select pkg_admin.guardar_rubro(null, 'Otro', 'otro', null)`))?.includes('Solo el superadmin') &&
  (await falla(`select pkg_admin.describir_rubro($1, 'Otra')`, [modaArbol.id]))?.includes('Solo el superadmin'));
await como(admin);
await q(`select pkg_admin.activar_rubro($1, true)`, [alquileres.id]);
check('No se borra un rubro que usan las tiendas',
  (await falla(`select pkg_admin.eliminar_rubro($1)`, [calzado]))?.includes('Hay tiendas'));
check('No se borra un rubro con subrubros adentro',
  (await falla(`select pkg_admin.eliminar_rubro($1)`, [modaArbol.id]))?.includes('Tiene rubros adentro'));
await q(`select pkg_admin.eliminar_rubro($1)`, [nuevo.id]);
check('Se borra un rubro sin uso', !(await uno(`select pkg_catalogo.rubros() r`)).r
  .find((r) => r.slug === 'alquileres').subrubros.some((s) => s.nombre === 'Drones'));
await comoServidorDb();
const conRubro = (await uno(`select pkg_admin.tiendas() r`)).r;
const usoRubros = (await uno(`select pkg_admin.rubros() r`)).r;
check('El admin ve el rubro de cada tienda y cuántas lo usan',
  conRubro.items.find((t) => t.id === A)?.rubro?.nombre === 'Indumentaria y moda' &&
  usoRubros.rubros.find((r) => r.id === modaArbol.id).tiendas >= 1 && typeof usoRubros.sinRubro === 'number');
check('Los cambios de rubros quedan en la auditoría',
  (await uno(`select count(*)::int n from public.auditoria where entidad = 'rubros' and actor_id = $1`, [admin])).n >= 3);

// Las respuestas tienen la forma que esperan la API y la web (packages/contratos).
const cumple = (contrato, origen, datos) => {
  try { verificar(contrato, origen, datos); return ''; } catch (e) { return e.message; }
};
const rubroPublico = (await uno(`select pkg_catalogo.rubro($1) r`, [A])).r;
await como(null);
const listadoTiendas = (await uno(`select pkg_catalogo.tiendas() r`)).r;
for (const [contrato, origen, datos] of [
  [opcionesRubro, 'pkg_catalogo.rubros', rubrosLista],
  [rubro, 'pkg_catalogo.rubro', rubroPublico],
  [tiendasResumen, 'pkg_catalogo.tiendas', listadoTiendas],
  [detalleTienda, 'pkg_tiendas.detalle', detalleA],
  [rubrosAdmin, 'pkg_admin.rubros', usoRubros],
]) {
  const error = cumple(contrato, origen, datos);
  check(`${origen} cumple su contrato`, !error, error);
}
check('El contrato detecta una respuesta con otra forma',
  cumple(detalleTienda, 'pkg_tiendas.detalle', { ...detalleA, especialidades: undefined }).includes('especialidades'));

// ---------------------------------------------------------------------------
log('\n24. Categorías estándar');
await como(null);
const menuEstandar = (await uno(`select pkg_catalogo.categorias() c`)).c;
const hijasDe = (ruta) => {
  const padre = menuEstandar.find((c) => c.ruta === ruta);
  return menuEstandar.filter((c) => c.padre_id === padre?.id);
};
check('La lista estándar trae las categorías con sus subcategorías y Alquileres con tres niveles',
  menuEstandar.filter((c) => c.padre_id === null).length >= 18 &&
  hijasDe('/alquileres/').length === 12 && hijasDe('/alquileres/inmuebles/').length === 9 &&
  hijasDe('/jardineria-viveros-y-agricultura/').some((c) => c.nombre === 'Insumos para cultivos'));
const veterinarios = menuEstandar.find((c) => c.ruta === '/mascotas-y-animales/productos-veterinarios/');
check('Productos veterinarios pasa por revisión y el resto no',
  veterinarios?.revision === true && menuEstandar.filter((c) => c.revision).length === 1);
{
  const error = cumple(contratoCategorias, 'pkg_catalogo.categorias', menuEstandar);
  check('pkg_catalogo.categorias cumple su contrato', !error, error);
}

await comoServidorDb();
const mati = await crearUsuario('mati@mascotas.com', 'Matías');
await como(mati);
const M = (await uno(`insert into public.tiendas (nombre, slug, cuit, localidad_id, direccion, rubro_id)
  values ('Tienda M', 'tienda-m', '20-44444444-4', $1, 'Sarmiento 50', $2) returning id`, [capital, moda])).id;
await comoServidorDb();
await q(`insert into public.suscripciones (tienda_id, plan_id, estado, fin_periodo)
  values ($1, $2, 'activa', now() + interval '30 days')`, [M, await plan('Premium')]);
await q(`update public.tiendas set revision_productos = 'nunca' where id = $1`, [M]);

await como(mati);
const productoEn = async (categoriaId, nombre, slug) => (await uno(`insert into public.productos
  (tienda_id, categoria_id, nombre, slug) values ($1, $2, $3, $4) returning id`, [M, categoriaId, nombre, slug])).id;
const publicar = async (id) => {
  await q(`insert into public.variantes (producto_id, precio, stock) values ($1, 9000, 10)`, [id]);
  await q(`update public.productos set estado = 'publicado' where id = $1`, [id]);
  return uno(`select estado, motivo_pausa from public.productos where id = $1`, [id]);
};
check('El producto no puede quedar en una categoría principal',
  (await falla(`insert into public.productos (tienda_id, categoria_id, nombre, slug) values ($1, $2, 'Alimento', 'alimento')`,
    [M, await cat('/mascotas-y-animales/')]))?.includes('subcategoría'));
check('En Alquileres también hay que elegir el tercer nivel',
  (await falla(`insert into public.productos (tienda_id, categoria_id, nombre, slug) values ($1, $2, 'Casa', 'casa')`,
    [M, await cat('/alquileres/inmuebles/')]))?.includes('qué tipo'));
const casa = await productoEn(await cat('/alquileres/inmuebles/casas/'), 'Casa en Rivadavia', 'casa-rivadavia');
check('Con categoría, subcategoría y tipo el producto se crea', !!casa);
check('Tampoco se puede pasar un producto a una categoría principal',
  (await falla(`update public.productos set categoria_id = $2 where id = $1`, [casa, await cat('/alquileres/')]))
    ?.includes('subcategoría'));

const pipeta = await productoEn(veterinarios.id, 'Pipeta antipulgas', 'pipeta');
const collar = await productoEn(await cat('/mascotas-y-animales/accesorios/'), 'Collar de cuero', 'collar');
const alPublicarPipeta = await publicar(pipeta);
check('Un producto veterinario pasa por moderación aunque la tienda publique sin revisión',
  alPublicarPipeta.estado === 'pausado' && alPublicarPipeta.motivo_pausa === 'revision', JSON.stringify(alPublicarPipeta));
check('Los demás productos de la tienda se publican al instante', (await publicar(collar)).estado === 'publicado');
await como(mora);
await q(`select pkg_admin.moderar_producto($1, 'aprobar')`, [pipeta]);
await como(mati);
check('Moderación lo aprueba y queda publicado',
  (await uno(`select estado from public.productos where id = $1`, [pipeta])).estado === 'publicado');
await q(`update public.productos set descripcion = 'Ahora también para gatos' where id = $1`, [pipeta]);
const pipetaEditada = await uno(`select estado, motivo_pausa from public.productos where id = $1`, [pipeta]);
check('Si cambia lo que se ve de un producto veterinario publicado, vuelve a revisión',
  pipetaEditada.estado === 'pausado' && pipetaEditada.motivo_pausa === 'revision');
await q(`update public.productos set descripcion = 'Cuero curtido a mano' where id = $1`, [collar]);
check('En otras categorías, editar un producto publicado no lo manda a revisión',
  (await uno(`select estado from public.productos where id = $1`, [collar])).estado === 'publicado');

const perros = await cat('/mascotas-y-animales/alimentos-para-perros/');
check('Solo moderación decide qué categorías pasan por revisión',
  (await falla(`select pkg_admin.revision_categoria($1, true)`, [perros]))?.includes('Solo moderación'));
await como(mora);
await q(`select pkg_admin.revision_categoria($1, true)`, [await cat('/alquileres/')]);
await comoServidorDb();
const fichaCasas = (await uno(`select pkg_admin.categoria($1) r`, [await cat('/alquileres/inmuebles/casas/')])).r;
const fichaVet = (await uno(`select pkg_admin.categoria($1) r`, [veterinarios.id])).r;
const listaAdmin = (await uno(`select pkg_admin.categorias() r`)).r;
check('El panel muestra la revisión propia y la heredada',
  fichaVet.requiere_revision === true && fichaVet.revisionDesde === null &&
  fichaCasas.requiere_revision === false && fichaCasas.revisionDesde?.nombre === 'Alquileres' &&
  listaAdmin.find((c) => c.ruta === '/alquileres/inmuebles/casas/')?.revision === true);
await como(mora);
await q(`select pkg_admin.revision_categoria($1, false)`, [await cat('/alquileres/')]);

// ---------------------------------------------------------------------------
log('\n25. Atributos estándar');
await como(null);
const fichaDe = async (ruta) => (await uno(`select pkg_catalogo.atributos_categoria($1) r`, [await cat(ruta)])).r;
const enFicha = (ficha, nombre) => ficha.find((a) => a.nombre === nombre);
const menu25 = (await uno(`select pkg_catalogo.categorias() c`)).c;
check('Se suman Industria y empresas (con sus subcategorías) y Vinos en Alimentos y bebidas',
  menu25.filter((c) => c.padre_id === menu25.find((x) => x.ruta === '/industria-y-empresas/')?.id).length === 3 &&
  menu25.some((c) => c.ruta === '/alimentos-y-bebidas/vinos/'));
{
  const raiz = menu25.filter((c) => !c.padre_id).sort((a, b) => b.productos - a.productos)[0];
  const subcategorias = menu25.filter((c) => c.padre_id === raiz.id);
  check('Cada categoría suma los productos publicados de sus subcategorías',
    raiz.productos > 0 && raiz.productos === subcategorias.reduce((total, c) => total + c.productos, 0),
    `${raiz.ruta}: ${raiz.productos}`);
}

const fichaMujer25 = await fichaDe('/ropa/ropa-de-mujer/');
const fichaCarteras = await fichaDe('/ropa/carteras-y-bolsos/');
check('La ropa varía por Talle y Color; carteras no piden talle y el color es un dato simple',
  enFicha(fichaMujer25, 'Talle')?.define_variante && enFicha(fichaMujer25, 'Color')?.define_variante &&
  !enFicha(fichaCarteras, 'Talle') && enFicha(fichaCarteras, 'Color')?.define_variante === false);
const fichaCelulares = await fichaDe('/tecnologia-y-electronica/celulares/');
const fichaTablets = await fichaDe('/tecnologia-y-electronica/tablets/');
check('Celulares varía por Memoria y Color; en el resto de Tecnología el color es un dato simple',
  enFicha(fichaCelulares, 'Memoria')?.define_variante && enFicha(fichaCelulares, 'Color')?.define_variante &&
  enFicha(fichaCelulares, 'Red móvil')?.tipo === 'lista' && enFicha(fichaTablets, 'Color')?.define_variante === false);
const fichaDeportiva = await fichaDe('/deportes-y-aire-libre/indumentaria-deportiva/');
const fichaPesca = await fichaDe('/deportes-y-aire-libre/pesca/');
check('La subcategoría puede convertir en variante un atributo que la categoría tiene como dato',
  enFicha(fichaDeportiva, 'Talle')?.define_variante && enFicha(fichaPesca, 'Talle')?.define_variante === false);

const fichaCasas25 = await fichaDe('/alquileres/inmuebles/casas/');
const unidad = enFicha(fichaCasas25, 'Unidad de cobro');
check('Todo alquiler se cobra por unidad (variante obligatoria) y hereda la ficha de su subcategoría',
  unidad?.define_variante && unidad.obligatorio && unidad.opciones.some((o) => o.valor === 'Día') &&
  enFicha(fichaCasas25, 'Dormitorios')?.tipo === 'numero' && enFicha(fichaCasas25, 'Pileta')?.tipo === 'si_no' &&
  enFicha(fichaCasas25, 'Seña requerida'));
check('Fuera de las variantes, ningún atributo estándar es obligatorio',
  (await uno(`select count(*)::int n from public.categorias_atributos where obligatorio and not define_variante`)).n === 0);
check('Las experiencias de turismo tienen su propia ficha y el equipamiento no',
  !!enFicha(await fichaDe('/turismo-y-actividades/experiencias/'), 'Punto de encuentro') &&
  !enFicha(await fichaDe('/turismo-y-actividades/equipamiento-para-turismo/'), 'Punto de encuentro'));

const fichaVinos = await fichaDe('/alimentos-y-bebidas/vinos/');
const posicion = (nombre) => fichaVinos.findIndex((a) => a.nombre === nombre);
check('La ficha sigue el orden de la lista: primero lo de la categoría, después lo de la subcategoría',
  posicion('Marca') === 0 && posicion('Marca') < posicion('Fecha de vencimiento') &&
  posicion('Fecha de vencimiento') < posicion('Bodega') && posicion('Bodega') < posicion('Región de origen'));

await como(mati);
const opcionDe = (a, valor) => a.opciones.find((o) => o.valor === valor).id;
const guardarAlquiler = (variantes) => uno(`select pkg_productos.guardar($1, null, $2::jsonb, 'quincho') r`, [M,
  JSON.stringify({
    categoria_id: menu25.find((c) => c.ruta === '/alquileres/fiestas-y-eventos/mesas-y-sillas/').id,
    nombre: 'Juego de mesas y sillas', descripcion: '',
    atributos: [{ atributo_id: enFicha(fichaCasas25, 'Seña requerida').id, valor_texto: 'Sí' }],
    variantes,
  })]);
check('Un alquiler sin unidad de cobro no se guarda',
  (await falla(`select pkg_productos.guardar($1, null, $2::jsonb, 'x')`, [M, JSON.stringify({
    categoria_id: menu25.find((c) => c.ruta === '/alquileres/fiestas-y-eventos/mesas-y-sillas/').id,
    nombre: 'Sin unidad', variantes: [{ opciones: [], precio: 100, stock: 1 }] })]))?.includes('Unidad de cobro'));
const alquiler = (await guardarAlquiler([
  { opciones: [{ atributo_id: unidad.id, opcion_id: opcionDe(unidad, 'Día') }], precio: 15000, stock: 4 },
  { opciones: [{ atributo_id: unidad.id, opcion_id: opcionDe(unidad, 'Evento') }], precio: 40000, stock: 4 },
])).r;
check('Con precio por día y por evento se guarda con dos variantes',
  (await uno(`select count(*)::int n from public.variantes where producto_id = $1`, [alquiler])).n === 2);

// ---------------------------------------------------------------------------
log('\n26. Importar productos desde la plantilla');
await como(mati);
const talle = enFicha(fichaMujer25, 'Talle');
const color = enFicha(fichaMujer25, 'Color');
const deMujer = menu25.find((c) => c.ruta === '/ropa/ropa-de-mujer/').id;
const aImportar = (codigo, nombre, categoriaId = deMujer, variantes = ['S', 'M'].map((t, i) => ({
  opciones: [{ atributo_id: talle.id, opcion_id: opcionDe(talle, t) },
             { atributo_id: color.id, opcion_id: color.opciones[0].id }],
  precio: 12000 + i * 500, precio_oferta: null, stock: 3, sku: `${codigo}-${t}`,
}))) => ({
  codigo, slug: nombre.toLowerCase().replace(/\s+/g, '-'),
  datos: { categoria_id: categoriaId, nombre, descripcion: null, atributos: [], variantes },
});
const productosDeM = async () => (await uno(`select count(*)::int n from public.productos where tienda_id = $1`, [M])).n;
const importar = (productos, publicar, probar) => uno(`select pkg_productos.importar($1, $2::jsonb, $3, $4) r`,
  [M, JSON.stringify(productos), publicar, probar]);

const antes26 = await productosDeM();
const prueba = (await importar([aImportar('REM-1', 'Remera lisa'), aImportar('REM-2', 'Remera rayada')], true, true)).r;
check('La vista previa no guarda nada y avisa qué no se va a poder publicar por el límite del plan',
  prueba.guardado === false && prueba.errores.length === 0 && prueba.productos.every((p) => !p.id) &&
  prueba.productos[0].estado === 'publicado' && prueba.productos[1].estado === 'borrador' &&
  prueba.productos[1].aviso?.includes('plan') && (await productosDeM()) === antes26, JSON.stringify(prueba));

const conError = (await importar([
  aImportar('REM-1', 'Remera lisa'),
  aImportar('ALI-1', 'Alimento', await cat('/mascotas-y-animales/'), [{ opciones: [], precio: 100, stock: 1 }]),
], false, false)).r;
check('Si un producto falla no se guarda ninguno y se informa cuál y por qué',
  conError.guardado === false && conError.errores.length === 1 && conError.errores[0].codigo === 'ALI-1' &&
  conError.errores[0].mensaje.includes('subcategoría') && (await productosDeM()) === antes26,
  JSON.stringify(conError.errores));

const importados = (await importar([
  aImportar('VET-1', 'Pipeta x3', veterinarios.id, [{ opciones: [], precio: 5000, stock: 2 }]),
  aImportar('REM-1', 'Remera lisa'), aImportar('REM-2', 'Remera lisa'),
], true, false)).r;
const enBase = await q(`select p.slug, p.estado, (select count(*)::int from public.variantes v where v.producto_id = p.id) n
  from public.productos p where p.id = any($1::uuid[]) order by p.creado_en, p.slug`,
  [importados.productos.map((p) => p.id)]);
check('Al confirmar se crean todos con sus variantes y nombres repetidos no chocan',
  importados.guardado === true && enBase.length === 3 && enBase.every((p) => p.n === (p.slug.startsWith('pipeta') ? 1 : 2)) &&
  new Set(enBase.map((p) => p.slug)).size === 3, JSON.stringify(enBase));
const [vet, rem1, rem2] = importados.productos;
check('Publicar respeta la revisión por categoría y el plan: el que no entra queda en borrador',
  vet.estado === 'pausado' && vet.motivo_pausa === 'revision' && rem1.estado === 'publicado' &&
  rem2.estado === 'borrador' && rem2.aviso?.includes('plan'), JSON.stringify(importados.productos));

await como(diego);
check('Quien no es de la tienda no puede importar',
  (await falla(`select pkg_productos.importar($1, $2::jsonb, false, true)`, [M, JSON.stringify([aImportar('X', 'X')])]))
    ?.includes('permiso'));
await como(mati);
check('Hay un máximo de productos por archivo',
  (await falla(`select pkg_productos.importar($1, $2::jsonb, false, true)`,
    [M, JSON.stringify(Array.from({ length: 501 }, (_, i) => aImportar(`R${i}`, `Remera ${i}`)))]))?.includes('500'));

// ---------------------------------------------------------------------------
log('\n27. Cuentas completas: DNI, domicilio, términos, Google y recuperar la contraseña');
await db.exec('reset role');
const registrar = (datos) => uno(`select pkg_auth.registrar_cliente($1::jsonb, 'hash-1') r`, [JSON.stringify({
  nombre: 'Lola', apellido: 'Paz', terminos: '2026-10-11',
  domicilio: { calle: 'Av. Rioja', numero: '450', localidad_id: capital }, ...datos,
})]);
const lola = (await registrar({ email: 'LOLA@correo.com', dni: '38.123.456', telefono: '264 111' })).r;
const sesionLola = (await uno(`select pkg_auth.sesion($1) r`, [lola])).r;
const cuentaLola = await uno(`select dni, terminos_version, terminos_aceptados_en from public.datos_cuenta where usuario_id = $1`, [lola]);
const domicilioLola = await q(`select calle, numero, es_principal from public.direcciones where usuario_id = $1`, [lola]);
check('El registro guarda en un paso la cuenta, el DNI sin puntos, los términos y el domicilio principal',
  sesionLola.email === 'lola@correo.com' && sesionLola.dni === '38123456' && sesionLola.telefono === '264 111' &&
  sesionLola.tieneClave === true && sesionLola.conGoogle === false && cuentaLola.terminos_version === '2026-10-11' &&
  !!cuentaLola.terminos_aceptados_en && domicilioLola.length === 1 && domicilioLola[0].es_principal,
  JSON.stringify({ sesionLola, cuentaLola, domicilioLola }));
check('Sin aceptar los términos no se crea la cuenta',
  (await falla(`select pkg_auth.registrar_cliente($1::jsonb, 'h')`,
    [JSON.stringify({ email: 'sin@terminos.com', nombre: 'S', apellido: 'T', dni: '30111222' })]))?.includes('Términos'));
check('Un DNI no puede estar en dos cuentas',
  (await falla(`select pkg_auth.registrar_cliente($1::jsonb, 'h')`,
    [JSON.stringify({ email: 'otra@correo.com', nombre: 'O', apellido: 'C', dni: '38123456', terminos: 'v' })]))?.includes('DNI'));
check('El DNI son 7 u 8 números',
  (await falla(`select pkg_auth.registrar_cliente($1::jsonb, 'h')`,
    [JSON.stringify({ email: 'otra@correo.com', nombre: 'O', apellido: 'C', dni: '12A', terminos: 'v' })]))?.includes('DNI'));
check('Si el registro falla no queda nada a medias',
  (await uno(`select count(*)::int n from auth.users where email in ('sin@terminos.com', 'otra@correo.com')`)).n === 0);

await como(diego);
check('Nadie más ve el DNI de una cuenta',
  (await uno(`select count(*)::int n from public.datos_cuenta where usuario_id = $1`, [lola])).n === 0);
await como(lola);
check('El dueño ve sus datos privados',
  (await uno(`select dni from public.datos_cuenta where usuario_id = $1`, [lola]))?.dni === '38123456');
check('Los pedidos de recuperación de contraseña no se ven desde la app',
  (await uno(`select count(*)::int n from public.recuperaciones_clave`)).n === 0);

await db.exec('reset role');
check('Desde "Mi cuenta" el DNI se cambia, pero no a uno de otra cuenta',
  (await falla(`select pkg_auth.guardar_dni($1, '38123456')`, [diego]))?.includes('DNI') &&
  !(await falla(`select pkg_auth.guardar_dni($1, '30999888')`, [diego])) &&
  (await uno(`select pkg_auth.sesion($1) r`, [diego])).r.dni === '30999888');

const google = (sub, email, terminos = null) =>
  uno(`select pkg_auth.ingresar_google($1, $2, 'Gabi', 'Sol', 'https://foto', $3) r`, [sub, email, terminos]);
check('Con Google, una cuenta nueva exige aceptar los términos',
  (await falla(`select pkg_auth.ingresar_google('g-1', 'gabi@gmail.com', 'Gabi', 'Sol', null, null)`))?.includes('Términos'));
const gabi = (await google('g-1', 'gabi@gmail.com', '2026-10-11')).r;
const sesionGabi = (await uno(`select pkg_auth.sesion($1) r`, [gabi.id])).r;
check('Con Google se crea la cuenta sin contraseña y con su foto',
  gabi.nueva === true && sesionGabi.tieneClave === false && sesionGabi.conGoogle === true &&
  sesionGabi.nombre === 'Gabi' && sesionGabi.avatar_url === 'https://foto', JSON.stringify(sesionGabi));
const deNuevo = (await google('g-1', 'otro-correo@gmail.com')).r;
check('La segunda vez entra a la misma cuenta, aunque cambie el correo', deNuevo.id === gabi.id && deNuevo.nueva === false);
const vinculada = (await google('g-2', 'lola@correo.com')).r;
check('Si ya tenía cuenta con ese correo, Google se vincula a ella',
  vinculada.id === lola && vinculada.nueva === false &&
  (await uno(`select pkg_auth.sesion($1) r`, [lola])).r.conGoogle === true);

check('Pedir un enlace con un correo sin cuenta no revela nada',
  (await uno(`select pkg_auth.crear_recuperacion('nadie@correo.com', 'h-0', 30) r`)).r === null);
const pedido1 = (await uno(`select pkg_auth.crear_recuperacion('Lola@Correo.com', 'h-1', 30) r`)).r;
await uno(`select pkg_auth.crear_recuperacion('lola@correo.com', 'h-2', 30) r`);
check('El enlace nuevo anula al anterior',
  pedido1?.nombre === 'Lola' && (await uno(`select pkg_auth.recuperacion_valida('h-1') r`)).r === false &&
  (await uno(`select pkg_auth.recuperacion_valida('h-2') r`)).r === true);
const restablecida = (await uno(`select pkg_auth.restablecer_clave('h-2', 'hash-nuevo') r`)).r;
const control = (await uno(`select pkg_auth.control_sesion($1) r`, [lola])).r;
check('Con el enlace se cambia la contraseña y se cierran las sesiones abiertas',
  restablecida === lola && (await uno(`select pkg_auth.hash_actual($1) r`, [lola])).r === 'hash-nuevo' &&
  control.bloqueo === null && !!control.sesiones_desde, JSON.stringify(control));
check('El enlace sirve una sola vez',
  (await falla(`select pkg_auth.restablecer_clave('h-2', 'otra')`))?.includes('venció o ya se usó'));
await uno(`select pkg_auth.crear_recuperacion('lola@correo.com', 'h-3', 30) r`);
await q(`update public.recuperaciones_clave set vence_en = now() - interval '1 minute' where token_hash = 'h-3'`);
check('Un enlace vencido no sirve',
  (await falla(`select pkg_auth.restablecer_clave('h-3', 'otra')`))?.includes('venció o ya se usó'));
for (let i = 4; i <= 6; i++) await uno(`select pkg_auth.crear_recuperacion('lola@correo.com', $1, 30) r`, [`h-${i}`]);
check('Hay un máximo de pedidos por hora',
  (await uno(`select pkg_auth.crear_recuperacion('lola@correo.com', 'h-7', 30) r`)).r === null);

log('\n28. Teléfonos y ubicación de la tienda');
await como(ana);
const contacto = (cambios) => falla(`select pkg_tiendas.guardar_contacto($1, $2::jsonb)`, [A, JSON.stringify(cambios)]);
check('Se guardan varios teléfonos; las filas vacías se descartan y el primero es el principal',
  !(await contacto({
    telefonos: [
      { pais: '+54', numero: ' 264  4123456 ', tipo: 'whatsapp' },
      { pais: '+54', numero: '', tipo: 'fijo' },
      { pais: '+56', numero: '9 8765 4321', tipo: 'celular' },
    ],
    ubicacion: { lat: -31.5375123, lng: -68.5363999 },
  })));
const detalleContacto = (await uno(`select pkg_tiendas.detalle($1) r`, [A])).r;
check('El panel muestra los teléfonos y la ubicación',
  detalleContacto.telefonos.length === 2 && detalleContacto.telefonos[0].numero === '264 4123456' &&
  detalleContacto.telefono === '+54 264 4123456' && detalleContacto.ubicacion?.lat === -31.537512,
  JSON.stringify(detalleContacto));
const errorContrato = cumple(detalleTienda, 'pkg_tiendas.detalle', detalleContacto);
check('pkg_tiendas.detalle con teléfonos cumple su contrato', !errorContrato, errorContrato);
check('Un tipo de teléfono desconocido no se guarda',
  (await contacto({ telefonos: [{ pais: '+54', numero: '264 4123456', tipo: 'fax' }] }))?.includes('tipo'));
check('Un número con letras no se guarda',
  (await contacto({ telefonos: [{ pais: '+54', numero: '264-ABC-123', tipo: 'fijo' }] }))?.includes('no es válido'));
check('Hasta 5 teléfonos',
  (await contacto({ telefonos: Array.from({ length: 6 }, (_, i) => ({ numero: `264 41234${i}0` })) }))?.includes('5'));
check('Una ubicación fuera del mapa no se guarda',
  (await contacto({ ubicacion: { lat: 120, lng: 0 } }))?.includes('ubicación'));
check('Sin teléfonos el principal queda vacío y la ubicación se puede quitar',
  !(await contacto({ telefonos: [], ubicacion: null })) &&
  (await uno(`select telefono, lat from public.tiendas where id = $1`, [A])).telefono === null);
await como(diego);
check('Quien no es de la tienda no cambia sus teléfonos',
  (await contacto({ telefonos: [{ numero: '264 4123456' }] }))?.includes('permiso'));

// Reglas que toda tabla nueva tiene que cumplir.
await db.exec('reset role');
const sinRls = await q(`select tablename from pg_tables where schemaname = 'public' and not rowsecurity`);
check('Todas las tablas tienen seguridad por filas (RLS)', sinRls.length === 0, JSON.stringify(sinRls));
const sinTrigger = await q(`
  select c.table_name from information_schema.columns c
  where c.table_schema = 'public' and c.column_name = 'actualizado_en'
    and not exists (select 1 from information_schema.triggers t
                    where t.event_object_schema = 'public' and t.event_object_table = c.table_name
                      and t.trigger_name = 'actualizado_en')`);
check('Todas las tablas con actualizado_en lo mantienen al día', sinTrigger.length === 0, JSON.stringify(sinTrigger));

// ---------------------------------------------------------------------------
const resumen = `\nResultado: ${ok} pruebas correctas, ${fallas} fallidas.`;
log(resumen);
const { writeFileSync } = await import('node:fs');
writeFileSync(new URL('./resultado_pruebas.txt', import.meta.url), lineas.join('\n') + '\n');
process.exit(fallas ? 1 : 0);
