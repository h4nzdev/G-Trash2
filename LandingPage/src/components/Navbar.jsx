import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Menu, X, Trash2 } from "lucide-react";
import logo from "../assets/logo.png";

const links = [
  { label: "Features", id: "features" },
  { label: "How It Works", id: "how-it-works" },
  { label: "Roles", id: "roles" },
  { label: "Download", id: "download" },
  { label: "About", id: "about" },
];

const Navbar = () => {
  const navRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    gsap.from(navRef.current, {
      y: -80,
      opacity: 0,
      duration: 1,
      ease: "power3.out",
      delay: 0.4,
    });

    const handleScroll = () => {
      if (window.scrollY > 60) {
        gsap.to(navRef.current, {
          backgroundColor: "rgba(6,13,6,0.92)",
          duration: 0.3,
          ease: "none",
        });
      } else {
        gsap.to(navRef.current, {
          backgroundColor: "rgba(6,13,6,0)",
          duration: 0.3,
          ease: "none",
        });
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  return (
    <nav
      ref={navRef}
      className="fixed top-0 left-0 right-0 z-50 px-6 py-4"
      style={{ backdropFilter: "blur(12px)" }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
            <img src={logo} alt="Gtrash logo" />
          </div>
          <span className="text-xl font-black text-white tracking-tight">
            G-TRASH
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <button
              key={link.id}
              onClick={() => scrollTo(link.id)}
              className="text-gray-400 hover:text-green-400 transition-colors text-sm font-medium cursor-pointer"
            >
              {link.label}
            </button>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <button className="text-sm text-gray-400 hover:text-white transition-colors font-medium cursor-pointer">
            Log In
          </button>
          <button className="bg-green-500 hover:bg-green-400 text-black text-sm font-bold px-5 py-2 rounded-lg transition-all hover:scale-105 cursor-pointer">
            Get Started
          </button>
        </div>

        <button
          className="md:hidden text-white p-1"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden mt-3 mx-0 p-4 bg-[#0a1a0a] border border-green-900/50 rounded-xl">
          {links.map((link) => (
            <button
              key={link.id}
              onClick={() => scrollTo(link.id)}
              className="block w-full text-left py-3 px-2 text-gray-300 hover:text-green-400 transition-colors text-sm border-b border-green-900/30 last:border-0"
            >
              {link.label}
            </button>
          ))}
          <button className="mt-3 w-full bg-green-500 hover:bg-green-400 text-black font-bold py-2.5 rounded-lg transition-colors text-sm">
            Get Started
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
