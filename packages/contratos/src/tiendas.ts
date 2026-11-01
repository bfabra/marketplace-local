import { z } from 'zod';
import { contador, uuid } from './comunes.js';
import { rubro } from './rubros.js';

export const estadoTienda = z.enum(['pendiente', 'activa', 'suspendida', 'vencida', 'archivada']);
export type EstadoTienda = z.infer<typeof estadoTienda>;

export const tipoTelefono = z.enum(['whatsapp', 'celular', 'fijo']);
export type TipoTelefono = z.infer<typeof tipoTelefono>;

/** Un teléfono de la tienda; el primero de la lista es el principal. */
export const telefonoTienda = z.object({ pais: z.string(), numero: z.string(), tipo: tipoTelefono });
export type TelefonoTienda = z.infer<typeof telefonoTienda>;

export const ubicacion = z.object({ lat: z.number(), lng: z.number() });
export type Ubicacion = z.infer<typeof ubicacion>;

/** pkg_tiendas.detalle(): la tienda en su panel, con lo que el usuario puede hacer en ella. */
export const detalleTienda = z.object({
  id: uuid,
  nombre: z.string(),
  slug: z.string(),
  descripcion: z.string().nullable(),
  cuit: z.string(),
  razon_social: z.string().nullable(),
  telefono: z.string().nullable(),
  telefonos: z.array(telefonoTienda),
  email: z.string().nullable(),
  direccion: z.string(),
  /** Se carga al importar el local desde Google Maps. */
  ubicacion: ubicacion.nullable(),
  estado: estadoTienda,
  motivo_estado: z.string().nullable(),
  creado_en: z.string(),
  /** Ruta en el storage; el API la convierte en URL. */
  portada: z.string().nullable(),
  logo: z.string().nullable(),
  localidad: z.object({ id: uuid, nombre: z.string(), provincia: z.string() }),
  /** null: la tienda es anterior a los rubros y el dueño todavía no lo eligió. */
  rubro: z.object({ id: uuid, nombre: z.string(), slug: z.string() }).nullable(),
  subrubro: z.object({ id: uuid, nombre: z.string() }).nullable(),
  especialidades: z.array(z.object({ id: uuid, nombre: z.string() })),
  esDuenio: z.boolean(),
  permisos: z.array(z.string()),
  plan: z
    .object({
      nombre: z.string(),
      es_gratis: z.boolean(),
      max_productos: z.number().int().nullable(),
      max_empleados: z.number().int().nullable(),
      estado: z.string(),
      fin_periodo: z.string().nullable(),
    })
    .nullable(),
  mercadoPago: z.object({ vinculada: z.boolean(), esPrueba: z.boolean() }),
});
export type DetalleTienda = z.infer<typeof detalleTienda>;

/** Lo que responde la API: el detalle más lo que depende del entorno. */
export const tienda = detalleTienda.extend({ mpPruebaDisponible: z.boolean() });
export type Tienda = z.infer<typeof tienda>;

/** pkg_catalogo.tiendas() y tarjetas de tienda de la portada. */
export const tiendaResumen = z.object({
  id: uuid,
  nombre: z.string(),
  slug: z.string(),
  descripcion: z.string().nullable(),
  localidad: z.string(),
  localidad_id: uuid.optional(),
  portada: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
  productos: contador,
  nueva: z.boolean().optional(),
  rubro: rubro.nullable().optional(),
});
export const tiendasResumen = z.array(tiendaResumen);
export type TiendaResumen = z.infer<typeof tiendaResumen>;
