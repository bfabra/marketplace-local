import Link from 'next/link';

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <section className="card">
      <h1>{title}</h1>
      <p className="muted">{description}</p>
      <p>
        <Link href="/">Volver al inicio</Link>
      </p>
    </section>
  );
}
