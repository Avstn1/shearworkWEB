export default function Footer() {
  return (
    <footer className="py-6 text-center text-[var(--text-subtle)] bg-[var(--background)] border-t border-[var(--accent-2)]">
      © {new Date().getFullYear()} ShearWork. All rights reserved.
    </footer>
  )
}
