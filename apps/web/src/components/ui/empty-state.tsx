import { Icon, type IconName } from './icon';

export function EmptyState({
  icono,
  titulo,
  children,
  acciones,
}: {
  icono: IconName;
  titulo: string;
  children?: React.ReactNode;
  acciones?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state-icono">
        <Icon name={icono} size={32} strokeWidth={1.75} />
      </span>
      <h2>{titulo}</h2>
      {children && <p className="muted">{children}</p>}
      {acciones && <div className="actions empty-state-acciones">{acciones}</div>}
    </div>
  );
}
