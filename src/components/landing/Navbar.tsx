import { useState } from "react";
import { Menu, X } from "lucide-react";
import logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const navLinks = [
  { label: "Fonctionnalités", href: "#fonctionnalites" },
  { label: "Comment ça marche", href: "#processus" },
  { label: "Contact", href: "#contact" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-primary/10 bg-dark-green/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <a href="#" className="flex items-center gap-2">
          <img src={logo} alt="Commission Fiscale" className="h-8 w-8" />
          <div className="leading-tight">
            <span className="block text-sm font-bold text-primary-foreground">Commission Fiscale</span>
            <span className="block text-[10px] font-medium text-gold-light tracking-wider uppercase">Mauritanie</span>
          </div>
        </a>

        {/* Desktop */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="rounded-lg px-4 py-2 text-sm font-medium text-primary-foreground/80 transition-colors hover:bg-primary/20 hover:text-primary-foreground"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Button variant="outline" className="border-gold text-gold hover:bg-gold/20 hover:text-gold" asChild>
            <Link to="/register">S'inscrire</Link>
          </Button>
          <Button className="bg-gold text-accent-foreground font-semibold hover:bg-gold-light" asChild>
            <Link to="/login">Se connecter</Link>
          </Button>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setOpen(!open)} className="text-primary-foreground md:hidden">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-primary/10 bg-dark-green px-6 pb-6 pt-4 md:hidden">
          {navLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-4 py-3 text-sm font-medium text-primary-foreground/80 hover:bg-primary/20"
            >
              {l.label}
            </a>
          ))}
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="outline" className="w-full border-gold text-gold hover:bg-gold/20 hover:text-gold" asChild>
              <Link to="/register">S'inscrire</Link>
            </Button>
            <Button className="w-full bg-gold text-accent-foreground font-semibold hover:bg-gold-light" asChild>
              <Link to="/login">Se connecter</Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
