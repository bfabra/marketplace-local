import type {
  Categoria,
  EstadoTienda,
  OpcionRubro,
  Rubro,
  RubroAdmin,
  RubroLista,
  RubrosAdmin,
  TelefonoTienda,
  Tienda,
  TiendaResumen,
  TipoTelefono,
  Ubicacion,
} from '@marketplace/contratos';

// Respuestas que ya tienen contrato compartido con la API (packages/contratos).
export type {
  Categoria,
  EstadoTienda,
  OpcionRubro,
  Rubro,
  RubroAdmin,
  RubroLista,
  RubrosAdmin,
  TelefonoTienda,
  Tienda,
  TiendaResumen,
  TipoTelefono,
  Ubicacion,
};

// Ruta del proxy de Next.js (next.config.mjs) hacia apps/api.
export const API_URL = '/api';

export interface ErrorDetail {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: ErrorDetail[] = []
  ) {
    super(message);
  }
}

export interface TiendaUsuario {
  id: string;
  nombre: string;
  slug: string;
  estado: EstadoTienda;
  rol: string;
}

export interface Usuario {
  id: string;
  email: string | null;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  avatar_url: string | null;
  creado_en: string;
  dni: string | null;
  /** false: entra solo con Google (puede crear una contraseña desde "Mi cuenta"). */
  tieneClave: boolean;
  conGoogle: boolean;
  rolesPlataforma: RolPlataforma[];
  tiendas: TiendaUsuario[];
}

export interface AuthResponse {
  user: Usuario;
}

/** Funciones que dependen de servicios externos: solo se muestran las configuradas en el API. */
export interface OpcionesPlataforma {
  googleClientId: string | null;
  googleMaps: boolean;
  recuperarClave: boolean;
}

/** Un local encontrado en Google Maps para completar el alta. */
export interface LugarGoogle {
  placeId: string;
  nombre: string;
  direccion: string;
  direccionCompleta: string;
  localidad: Localidad | null;
  telefono: TelefonoTienda | null;
  ubicacion: Ubicacion;
  mapsUrl: string | null;
}

export interface Localidad {
  id: string;
  nombre: string;
  provincia: string;
}

export interface DatosTienda {
  nombre: string;
  descripcion?: string;
  cuit: string;
  razon_social?: string;
  telefonos?: TelefonoTienda[];
  ubicacion?: Ubicacion | null;
  email?: string;
  localidad_id: string;
  direccion: string;
  rubro_id: string;
  subrubro_id?: string | null;
  especialidades?: string[];
}

export type PoliticaRevision = 'automatica' | 'siempre' | 'nunca';

export interface TiendaAdmin {
  id: string;
  nombre: string;
  slug: string;
  cuit: string;
  estado: EstadoTienda;
  motivo_estado: string | null;
  revision_productos: PoliticaRevision;
  creado_en: string;
  localidad: string;
  duenio: { nombre: string | null; email: string | null };
  mercadoPagoVinculada: boolean;
  plan: string | null;
  productos: { publicados: number; enRevision: number; total: number };
  ventas30: { pedidos: number; monto: number };
  denunciasAbiertas: number;
  rubro: RubroAdmin | null;
}

export interface PaginaTiendasAdmin {
  items: TiendaAdmin[];
  total: number;
  pagina: number;
  porPagina: number;
  conteos: Record<EstadoTienda, number>;
}

export interface FichaTiendaAdmin {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  cuit: string;
  razon_social: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string;
  estado: EstadoTienda;
  motivo_estado: string | null;
  revision_productos: PoliticaRevision;
  creado_en: string;
  localidad: string;
  rubro: RubroAdmin | null;
  mercadoPagoVinculada: boolean;
  duenio: {
    id: string;
    nombre: string | null;
    email: string | null;
    telefono: string | null;
    creado_en: string;
    otrasTiendas: { id: string; nombre: string; estado: EstadoTienda }[];
  };
  equipo: { nombre: string | null; email: string | null; rol: string; estado: string }[];
  suscripcion: {
    plan: string;
    precio_mensual: number;
    max_productos: number | null;
    estado: string;
    inicio: string;
    fin_periodo: string | null;
    gracia_hasta: string | null;
  } | null;
  productos: Record<
    'borrador' | 'publicado' | 'pausado' | 'enRevision' | 'rechazados' | 'moderacion' | 'aprobados',
    number
  >;
  revision: { activa: boolean; habilitadaGlobal: boolean; umbral: number };
  ventas: { pedidos30: number; monto30: number; pedidos: number; monto: number; enCurso: number };
  reclamosAbiertos: number;
  denunciasAbiertas: number;
  historial: {
    fecha: string;
    accion: 'INSERT' | 'UPDATE';
    estado: EstadoTienda;
    estadoAnterior: EstadoTienda | null;
    motivo: string | null;
    revision: PoliticaRevision | null;
    actor: string | null;
  }[];
}

export type VistaModeracion = 'revision' | 'rechazados' | 'moderacion' | 'publicados' | 'todos';

export interface ProductoModeracion extends Precio {
  id: string;
  nombre: string;
  slug: string;
  estado: EstadoProducto;
  motivo_pausa: MotivoPausa | null;
  nota_moderacion: string | null;
  revision_desde: string | null;
  publicado_en: string | null;
  actualizado_en: string;
  categoria: string;
  tienda: { id: string; nombre: string; slug: string; estado: EstadoTienda };
  imagen: string | null;
}

export interface ColaModeracion {
  items: ProductoModeracion[];
  total: number;
  pagina: number;
  porPagina: number;
  tienda: { id: string; nombre: string } | null;
  conteos: { revision: number; rechazados: number; moderacion: number };
}

export interface FichaProductoModeracion {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  estado: EstadoProducto;
  motivo_pausa: MotivoPausa | null;
  nota_moderacion: string | null;
  requiere_revision: boolean;
  revision_desde: string | null;
  publicado_en: string | null;
  aprobado_en: string | null;
  aprobadoPor: string | null;
  creado_en: string;
  actualizado_en: string;
  categoria: { nombre: string; ruta: string };
  tienda: {
    id: string;
    nombre: string;
    slug: string;
    estado: EstadoTienda;
    revision_productos: PoliticaRevision;
    aprobados: number;
  };
  ficha: { atributo: string; valor: string }[];
  variantes: {
    id: string;
    sku: string | null;
    precio: number;
    precio_oferta: number | null;
    stock: number;
    opciones: string | null;
  }[];
  imagenes: ImagenProducto[];
  historial: {
    fecha: string;
    estado: EstadoProducto;
    motivo: MotivoPausa | null;
    nota: string | null;
    actor: string | null;
  }[];
}

export type AccionModeracion = 'aprobar' | 'rechazar' | 'pausar' | 'reactivar';

export interface OpcionAtributo {
  id: string;
  valor: string;
}

export interface AtributoCategoria {
  id: string;
  nombre: string;
  tipo: 'texto' | 'numero' | 'lista' | 'si_no';
  unidad: string | null;
  obligatorio: boolean;
  define_variante: boolean;
  opciones: OpcionAtributo[];
}

export type EstadoProducto = 'borrador' | 'publicado' | 'pausado' | 'archivado';
export type MotivoPausa = 'manual' | 'limite_plan' | 'moderacion' | 'revision' | 'rechazado';

export interface Precio {
  precio: number | null;
  precio_oferta: number | null;
  desde: boolean;
  stock: number;
}

export interface ProductoListado extends Precio {
  id: string;
  nombre: string;
  slug: string;
  estado: EstadoProducto;
  motivo_pausa: MotivoPausa | null;
  nota_moderacion: string | null;
  categoria: string;
  variantes: number;
  imagen: string | null;
}

export interface ListadoProductos {
  productos: ProductoListado[];
  limite: { plan: string | null; max: number | null; publicados: number };
  revisionActiva: boolean;
}

export interface OpcionElegida {
  atributo_id: string;
  opcion_id: string;
}

export interface ValorAtributo {
  atributo_id: string;
  valor_texto?: string | null;
  valor_numero?: number | null;
  opcion_id?: string | null;
}

export interface DatosVariante {
  opciones: OpcionElegida[];
  precio?: number;
  precio_oferta?: number | null;
  stock?: number;
  sku?: string | null;
}

export interface DatosProducto {
  categoria_id: string;
  nombre: string;
  descripcion?: string;
  atributos: ValorAtributo[];
  variantes: DatosVariante[];
}

export interface ImagenProducto {
  id: string;
  url: string;
}

/** POST /stores/:id/products/importar: vista previa (sin confirmar) o resultado. */
export interface ResultadoImportacion {
  categoria: { id: string; etiqueta: string };
  filas: number;
  avisos: string[];
  guardado: boolean;
  productos: {
    codigo: string | null;
    nombre: string;
    filas: number[];
    variantes: number;
    precio: number;
    stock: number;
    /** Solo cuando se guardó. */
    id: string | null;
    estado: EstadoProducto | null;
    motivo_pausa: MotivoPausa | null;
    /** Por qué no se pudo publicar (queda en borrador). */
    aviso: string | null;
  }[];
  errores: { fila: number | null; columna: string | null; mensaje: string }[];
}

export interface ProductoEdicion {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  estado: EstadoProducto;
  motivo_pausa: ProductoListado['motivo_pausa'];
  nota_moderacion: string | null;
  categoria_id: string;
  atributos: ValorAtributo[];
  variantes: (Required<DatosVariante> & { id: string })[];
  imagenes: ImagenProducto[];
}

/** Rubro declarado por la tienda (la página de la tienda trae también subrubro y especialidades). */
export interface TarjetaProducto extends Precio {
  id: string;
  nombre: string;
  slug: string;
  imagen: string | null;
  tienda?: { nombre: string; slug: string; localidad: string; localidad_id: string };
  /** Categoría del último nivel. */
  categoria?: { nombre: string; slug: string };
  nuevo?: boolean;
  /** Si el producto tiene una sola variante, se puede agregar al carrito desde la tarjeta. */
  variante_unica?: string | null;
  /** Llega cuando existan reseñas. */
  calificacion?: { promedio: number; cantidad: number } | null;
}

export interface TiendaPublica {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  telefono: string | null;
  telefonos: TelefonoTienda[];
  direccion: string;
  ubicacion: Ubicacion | null;
  localidad: string;
  localidad_id: string;
  desde: string;
  /** URL de la foto de portada y del logo que subió la tienda. */
  portada: string | null;
  logo: string | null;
  rubro: Rubro | null;
  seguidores: number;
  productos: TarjetaProducto[];
}

export interface SeguidoresTienda {
  total: number;
  /** Se sumaron en los últimos 7 días. */
  semana: number;
}

export interface EstadoSeguimiento {
  ids: string[];
  seguidores: number;
}

export interface TiendaSeguida {
  id: string;
  nombre: string;
  slug: string;
  localidad: string;
  rubro: Rubro | null;
  /** Productos publicados en los últimos 14 días. */
  novedades: number;
}

export interface SugerenciasSeguidas {
  tiendas: TiendaSeguida[];
  productos: TarjetaProducto[];
}

export interface CategoriaInicio {
  id: string;
  nombre: string;
  slug: string;
  productos: number;
}

export interface Inicio {
  categorias: CategoriaInicio[];
  tiendas: TiendaResumen[];
  populares: TarjetaProducto[];
  novedades: TarjetaProducto[];
  cifras: { tiendas: number; productos: number; localidades: number };
}

export interface Sugerencias {
  productos: (Precio & { id: string; nombre: string; slug: string; tienda: string; tiendaSlug: string; imagen: string | null })[];
  tiendas: { id: string; nombre: string; slug: string; localidad: string }[];
  categorias: { id: string; nombre: string; ruta: string }[];
}

export type OrdenBusqueda = 'relevancia' | 'recientes' | 'precio_asc' | 'precio_desc';

export interface ResultadosBusqueda {
  total: number;
  pagina: number;
  paginas: number;
  productos: TarjetaProducto[];
}

export interface ProductoPublico {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  categoria: string;
  tienda: { nombre: string; slug: string; localidad: string };
  imagenes: (ImagenProducto & { alt: string | null })[];
  ficha: { nombre: string; valor: string | null }[];
  opcionesVariante: AtributoCategoria[];
  variantes: { id: string; precio: number; precio_oferta: number | null; stock: number; opciones: OpcionElegida[] }[];
}

export type EstadoMiembro = 'activo' | 'suspendido' | 'retirado';

export interface Permiso {
  codigo: string;
  area: string;
  descripcion: string;
}

export interface RolTienda {
  id: string;
  nombre: string;
  propio: boolean;
  permisos: string[];
  enUso: number;
}

export interface RolPredefinido {
  id: string;
  nombre: string;
  permisos: string[];
  personas: number;
  tiendas: number;
  invitaciones: number;
}

export interface RolesTiendaAdmin {
  roles: RolPredefinido[];
  permisos: Permiso[];
}

export interface Equipo {
  plan: { nombre: string | null; max_empleados: number | null };
  activos: number;
  miembros: {
    id: string;
    nombre: string | null;
    email: string | null;
    rol: { id: string; nombre: string };
    estado: EstadoMiembro;
    creado_en: string;
  }[];
  invitaciones: { id: string; email: string; rol: string; expira_en: string; vencida: boolean }[];
  roles: RolTienda[];
  permisos: Permiso[];
}

export interface InvitacionCreada {
  email: string;
  enlace: string;
}

export interface InvitacionPublica {
  tienda: string;
  rol: string;
  email: string;
  estado: 'pendiente' | 'aceptada' | 'vencida' | 'anulada';
  permisos: string[];
}

export interface Plan {
  id: string;
  nombre: string;
  precio_mensual: number;
  max_productos: number | null;
  max_empleados: number | null;
  es_gratis: boolean;
}

export interface PlanesTienda {
  actual: string | null;
  esDuenio: boolean;
  uso: { publicados: number; empleados: number };
  planes: Plan[];
}

export type RolPlataforma = 'superadmin' | 'moderacion' | 'soporte' | 'finanzas' | 'logistica';

export interface UsuarioConRoles {
  usuario_id: string;
  nombre: string | null;
  email: string | null;
  roles: RolPlataforma[];
}

// Cada bloque llega solo si el rol de plataforma lo puede ver.
export interface TableroAdmin {
  generadoEn: string;
  tiendas?: Record<'pendiente' | 'activa' | 'suspendida' | 'vencida' | 'archivada', number>;
  productos?: { publicados: number; enRevision: number; rechazados: number; pausadosModeracion: number };
  denunciasAbiertas?: number;
  usuarios?: { total: number; nuevos7dias: number; bloqueados: number };
  reclamosAbiertos?: number;
  solicitudesPendientes?: number;
  pedidos?: { hoy: number; pendientesPago: number; enCurso: number };
  ventasMes?: { monto: number; pedidos: number };
  reembolsosPendientes?: number;
  suscripciones?: { activa: number; en_gracia: number; pendiente: number; porVencer: number };
  envios?: { pendiente: number; en_recoleccion: number; en_camino: number; fallido: number };
}

export interface ParametroConfig {
  clave: string;
  etiqueta: string;
  descripcion: string | null;
  grupo: string;
  tipo: 'booleano' | 'entero' | 'texto';
  valor: boolean | number | string;
  minimo: number | null;
  maximo: number | null;
  actualizado_en: string;
  actualizadoPor: string | null;
}

export interface MovimientoAuditoria {
  id: number;
  creado_en: string;
  accion: 'INSERT' | 'UPDATE' | 'DELETE';
  entidad: string;
  entidad_id: string | null;
  referencia: string | null;
  actor: { nombre: string | null; email: string | null } | null;
  tienda: { id: string; nombre: string } | null;
  cambios: { campo: string; antes: unknown; despues: unknown }[] | null;
}

export interface ResumenActividad {
  total: number;
  altas: number;
  cambios: number;
  bajas: number;
  /** Personas distintas que hicieron cambios. */
  personas: number;
  /** Movimientos hechos por el sistema (sin autor). */
  sistema: number;
  desde: string | null;
  hasta: string | null;
}

export interface PaginaActividad {
  items: MovimientoAuditoria[];
  siguiente: number | null;
  /** Solo viene en la primera página. */
  resumen: ResumenActividad | null;
}

export interface ExportacionActividad {
  items: MovimientoAuditoria[];
  /** Hay más de 5.000 movimientos: se exportaron los más nuevos. */
  recortado: boolean;
}

export interface CategoriaAdmin {
  id: string;
  padre_id: string | null;
  nombre: string;
  slug: string;
  ruta: string;
  orden: number;
  activa: boolean;
  comision_pct: number;
  atributos: number;
  /** Cuenta también los de las subcategorías. */
  productos: { publicados: number; total: number };
  /** Marcada para revisión por moderación. */
  requiere_revision: boolean;
  /** Pasa por revisión, propia o heredada de una categoría que la contiene. */
  revision: boolean;
}

export type TipoAtributo = 'texto' | 'numero' | 'lista' | 'si_no';

export interface AtributoDeCategoria {
  id: string;
  nombre: string;
  tipo: TipoAtributo;
  unidad: string | null;
  obligatorio: boolean;
  define_variante: boolean;
  opciones: number;
  /** Categoría de la que lo hereda; null si es propio. */
  desde: { id: string; nombre: string } | null;
  /** Productos que lo tienen cargado (solo en los propios). */
  enUso: number | null;
}

export interface FichaCategoriaAdmin {
  id: string;
  padre_id: string | null;
  nombre: string;
  slug: string;
  ruta: string;
  orden: number;
  activa: boolean;
  comision_pct: number;
  creado_en: string;
  camino: { id: string; nombre: string; activa: boolean }[];
  subcategorias: { id: string; nombre: string; activa: boolean }[];
  productos: {
    publicados: number;
    pausados: number;
    borradores: number;
    archivados: number;
    total: number;
    tiendas: number;
  };
  atributos: AtributoDeCategoria[];
  requiere_revision: boolean;
  /** La categoría de más arriba que le pasa la revisión; null si es propia o no tiene. */
  revisionDesde: { id: string; nombre: string } | null;
}

export interface ResultadoVisibilidad {
  id: string;
  activa: boolean;
  categorias: number;
  productos: number;
  carritos: number;
}

export interface AtributoAdmin {
  id: string;
  nombre: string;
  tipo: TipoAtributo;
  unidad: string | null;
  filtrable: boolean;
  opciones: { id: string; valor: string; enUso: boolean }[];
  categorias: { id: string; nombre: string; ruta: string; define_variante: boolean }[];
  productos: number;
}

export interface ProvinciaAdmin {
  id: string;
  nombre: string;
  activa: boolean;
  localidades: number;
  localidadesActivas: number;
  tiendas: number;
}

export interface LocalidadAdmin {
  id: string;
  nombre: string;
  activa: boolean;
  tiendas: number;
  direcciones: number;
  tarifa: { costo: number; activa: boolean } | null;
}

export interface TerritorioAdmin {
  provincias: ProvinciaAdmin[];
  provincia: { id: string; nombre: string; activa: boolean } | null;
  localidades: LocalidadAdmin[];
  /** Localidades activas sin tarifa de envío activa. */
  sinEnvio: number;
}

interface Pagina<T, K extends string> {
  items: T[];
  total: number;
  pagina: number;
  porPagina: number;
  conteos: Record<K, number>;
}

// ---------- Panel: usuarios ----------
export type FiltroUsuarios = 'todos' | 'vendedores' | 'compradores' | 'equipo' | 'bloqueados';

export interface UsuarioAdmin {
  id: string;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  creado_en: string;
  ultimo_ingreso: string | null;
  roles: RolPlataforma[];
  tiendas: number;
  compras: number;
  bloqueo: { motivo: string; desde: string } | null;
}

export type PaginaUsuariosAdmin = Pagina<UsuarioAdmin, FiltroUsuarios>;

export interface FichaUsuarioAdmin {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  telefono: string | null;
  creado_en: string;
  ultimo_ingreso: string | null;
  roles: RolPlataforma[];
  bloqueo: { motivo: string; desde: string; por: string | null; tiendas: number } | null;
  historialBloqueos: {
    motivo: string;
    bloqueado_en: string;
    bloqueadoPor: string | null;
    desbloqueado_en: string | null;
    desbloqueadoPor: string | null;
    nota: string | null;
  }[];
  tiendas: {
    id: string;
    nombre: string;
    estado: EstadoTienda;
    motivo_estado: string | null;
    creado_en: string;
    plan: string | null;
  }[];
  equipos: { tienda: { id: string; nombre: string }; rol: string; estado: EstadoMiembro }[];
  compras: { pagadas: number; monto: number; ultima: string | null };
  ultimasCompras: {
    id: string;
    numero: number;
    creado_en: string;
    total: number;
    estado_pago: EstadoPago;
    tiendas: string[] | null;
  }[];
  direcciones: number;
  reclamosAbiertos: number;
}

export interface ResultadoBloqueo {
  resultado: { tiendasSuspendidas?: number; tiendasRestauradas?: number };
  usuario: FichaUsuarioAdmin;
}

// ---------- Panel: pedidos ----------
export type VistaPedidosAdmin = 'todos' | 'en_curso' | 'pendiente_pago' | 'reembolsos' | 'cancelados' | 'entregados';

export interface PedidoAdmin {
  id: string;
  numero: number;
  creado_en: string;
  total: number;
  estado_pago: EstadoPago;
  comprador: { id: string; nombre: string | null; email: string | null };
  partes: { tienda: string; estado: EstadoPedidoTienda; modalidad: Modalidad }[];
  reembolsoPendiente: number;
}

export type PaginaPedidosAdmin = Pagina<PedidoAdmin, 'en_curso' | 'pendiente_pago' | 'reembolsos'>;

export type EstadoReembolso = 'pendiente' | 'procesado' | 'rechazado';

export interface ReembolsoAdmin {
  id: string;
  tienda: string;
  monto: number;
  motivo: string;
  estado: EstadoReembolso;
  es_envio: boolean;
  nota: string | null;
  mp_refund_id: string | null;
  creado_en: string;
  creadoPor: string | null;
  procesado_en: string | null;
  procesadoPor: string | null;
}

export interface ParteAdmin {
  id: string;
  tienda: { id: string; nombre: string; telefono: string | null };
  modalidad: Modalidad;
  estado: EstadoPedidoTienda;
  subtotal: number;
  comision: number;
  total: number;
  motivo_cancelacion: string | null;
  listo_en: string | null;
  cancelable: boolean;
  /** Lo que todavía se puede devolver de esta parte. */
  reembolsable: number;
  items: { nombre: string; variante: string | null; precio_unitario: number; cantidad: number; subtotal: number }[];
  historial:
    | {
        fecha: string;
        anterior: EstadoPedidoTienda | null;
        estado: EstadoPedidoTienda;
        nota: string | null;
        actor: string | null;
      }[]
    | null;
  reclamos: { motivo: string; estado: string; creado_en: string }[] | null;
}

export interface FichaPedidoAdmin {
  id: string;
  numero: number;
  creado_en: string;
  subtotal: number;
  costo_envio: number;
  total: number;
  estado_pago: EstadoPago;
  direccion_envio: Pedido['direccion_envio'];
  permisos: { cancelar: boolean; reembolsar: boolean; verUsuarios: boolean };
  comprador: { id: string; nombre: string | null; email: string | null; telefono: string | null; bloqueado: boolean };
  partes: ParteAdmin[];
  envio: {
    estado: 'pendiente' | 'en_recoleccion' | 'en_camino' | 'entregado' | 'fallido';
    costo: number;
    entregado_en: string | null;
    repartidor: { nombre: string; telefono: string } | null;
    recolecciones:
      | { tienda: string; estado: string; llegada_en: string | null; recolectado_en: string | null }[]
      | null;
  } | null;
  reembolsos: ReembolsoAdmin[];
  /** Solo para finanzas. */
  pagos:
    | {
        id: string;
        mp_payment_id: string | null;
        monto: number;
        comision_marketplace: number;
        estado: string;
        creado_en: string;
      }[]
    | null;
}

// ---------- Panel: planes y suscripciones ----------
export interface PlanAdmin extends Plan {
  activo: boolean;
  orden: number;
  tiendas: number;
  enGracia: number;
  ingresoMensual: number;
}

export interface EfectosPlan {
  tiendas: number;
  productos: number;
  empleados: number;
}

export type EstadoSuscripcion = 'pendiente' | 'activa' | 'en_gracia' | 'vencida' | 'cancelada' | 'rechazada';
export type VistaSuscripciones = 'vigentes' | 'por_vencer' | 'en_gracia' | 'vencidas' | 'canceladas' | 'todas';

export interface SuscripcionAdmin {
  id: string;
  estado: EstadoSuscripcion;
  inicio: string;
  fin_periodo: string | null;
  gracia_hasta: string | null;
  tienda: { id: string; nombre: string; estado: EstadoTienda };
  duenio: { nombre: string | null; email: string | null };
  plan: { id: string; nombre: string; precio_mensual: number; es_gratis: boolean };
  ultimoPago: { periodo: string; monto: number; estado: string; pagado_en: string | null } | null;
}

export type PaginaSuscripcionesAdmin = Pagina<SuscripcionAdmin, Exclude<VistaSuscripciones, 'todas'>>;

export interface FichaSuscripcionAdmin {
  id: string;
  estado: EstadoSuscripcion;
  inicio: string;
  fin_periodo: string | null;
  gracia_hasta: string | null;
  motivo_cancelacion: string | null;
  nota_admin: string | null;
  debitoAutomatico: boolean;
  creado_en: string;
  diasGracia: number;
  tienda: { id: string; nombre: string; estado: EstadoTienda; motivo_estado: string | null };
  duenio: { id: string; nombre: string | null; email: string | null };
  plan: Plan & { activo: boolean };
  uso: { productos: number; pausadosPorLimite: number; empleados: number };
  pagos: {
    id: string;
    periodo: string;
    monto: number;
    estado: string;
    mp_payment_id: string | null;
    pagado_en: string | null;
  }[];
  otras: { id: string; plan: string; estado: EstadoSuscripcion; inicio: string; fin_periodo: string | null }[];
  historial: {
    fecha: string;
    accion: 'INSERT' | 'UPDATE' | 'DELETE';
    estado: EstadoSuscripcion | null;
    estadoAnterior: EstadoSuscripcion | null;
    plan: string | null;
    fin_periodo: string | null;
    finAnterior: string | null;
    nota: string | null;
    actor: string | null;
  }[];
}

export interface ItemCarrito {
  variante_id: string;
  cantidad: number;
}

export interface LineaCarrito extends ItemCarrito {
  nombre: string;
  slug: string;
  imagen: string | null;
  variante: string | null;
  precio: number;
  precio_lista: number;
  disponibles: number;
  ok: boolean;
  aviso: string | null;
}

export interface TiendaCarrito {
  id: string;
  nombre: string;
  slug: string;
  direccion: string;
  localidad: string;
  subtotal: number;
  items: LineaCarrito[];
}

export interface Carrito {
  tiendas: TiendaCarrito[];
  cantidad: number;
  subtotal: number;
  listo: boolean;
}

export interface Direccion {
  id: string;
  alias: string | null;
  calle: string;
  numero: string;
  piso_depto: string | null;
  localidad: { id: string; nombre: string; provincia: string };
  codigo_postal: string | null;
  referencias: string | null;
  es_principal: boolean;
  costo_envio: number | null;
}

export interface DatosDireccion {
  alias?: string | null;
  calle: string;
  numero: string;
  piso_depto?: string | null;
  localidad_id: string;
  codigo_postal?: string | null;
  referencias?: string | null;
  es_principal?: boolean;
}

export interface Checkout {
  carrito: Carrito;
  direcciones: Direccion[];
  retiroHabilitado: boolean;
  pagoSimulado: boolean;
}

export type EstadoPago = 'pendiente' | 'aprobado' | 'rechazado' | 'reembolsado_parcial' | 'reembolsado';
export type EstadoPedidoTienda =
  | 'pendiente'
  | 'pago_confirmado'
  | 'en_preparacion'
  | 'listo_para_recoleccion'
  | 'listo_para_retiro'
  | 'recolectado'
  | 'en_camino'
  | 'entregado'
  | 'cancelado'
  | 'rechazado';
export type Modalidad = 'entrega_plataforma' | 'retiro_en_local';

export interface ItemPedido {
  nombre: string;
  variante: string | null;
  precio: number;
  cantidad: number;
  subtotal: number;
}

export interface ResumenPedido {
  id: string;
  numero: number;
  total: number;
  estado_pago: EstadoPago;
  creado_en: string;
  unidades: number;
  partes: { tienda: string | null; estado: EstadoPedidoTienda; modalidad: Modalidad }[];
}

export interface Pedido {
  id: string;
  numero: number;
  estado_pago: EstadoPago;
  subtotal: number;
  costo_envio: number;
  total: number;
  direccion_envio: {
    calle: string;
    numero: string;
    piso_depto: string | null;
    localidad: string;
    provincia: string;
    referencias: string | null;
  } | null;
  creado_en: string;
  reservaHasta: string | null;
  partes: {
    id: string;
    tienda: { nombre: string; slug: string; direccion: string; localidad: string; telefono: string | null } | null;
    modalidad: Modalidad;
    estado: EstadoPedidoTienda;
    subtotal: number;
    motivo_cancelacion: string | null;
    items: ItemPedido[];
    historial: { estado: EstadoPedidoTienda; fecha: string }[] | null;
  }[];
}

export interface Venta {
  id: string;
  numero: number;
  creado_en: string;
  estado: EstadoPedidoTienda;
  modalidad: Modalidad;
  subtotal: number;
  comision: number;
  motivo_cancelacion: string | null;
  listo_en: string | null;
  comprador: { nombre: string | null; telefono: string | null } | null;
  items: ItemPedido[];
  acciones: EstadoPedidoTienda[];
}

export interface Health {
  ok: boolean;
  db: string;
  tablas: number;
}

const SIN_CONEXION =
  'No se pudo conectar con el API. ¿Está corriendo "npm run dev" en apps/api?';

// La sesión viaja en una cookie httpOnly que pone el API; el navegador la manda sola.
// Un FormData (archivos) se manda tal cual: el navegador arma el multipart.
export async function api<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown } = {}
): Promise<T> {
  const esFormulario = options.body instanceof FormData;
  const headers: Record<string, string> = {};
  if (options.body !== undefined && !esFormulario) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: esFormulario
        ? (options.body as FormData)
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(SIN_CONEXION, 0);
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    // Si el API está caído, el proxy de Next.js responde 500 sin cuerpo JSON.
    if (!data && res.status >= 500) throw new ApiError(SIN_CONEXION, 0);
    throw new ApiError(data?.error ?? `Error ${res.status}`, res.status, data?.details ?? []);
  }

  return data as T;
}

/**
 * Baja un archivo del API (por ejemplo, una plantilla de Excel) con la sesión actual.
 * Usa el nombre que manda el API y, si no viene, `nombre`.
 */
export async function descargar(path: string, nombre: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { credentials: 'same-origin' });
  } catch {
    throw new ApiError(SIN_CONEXION, 0);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    if (!data && res.status >= 500) throw new ApiError(SIN_CONEXION, 0);
    throw new ApiError(data?.error ?? `Error ${res.status}`, res.status);
  }
  const url = URL.createObjectURL(await res.blob());
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = res.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ?? nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
