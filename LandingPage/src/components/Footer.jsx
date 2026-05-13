import { Trash2, Mail, MapPin, Gift } from "lucide-react";
import logo from "../assets/logo.png";

const Footer = () => {
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <footer className="border-t border-green-900/25 px-6 pt-14 pb-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-12 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                <img src={logo} alt="Gtrash-logo" />
              </div>
              <span className="text-xl font-black tracking-tight">G-TRASH</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs mb-5">
              Smart Waste Monitoring System using IoT, AI, and mobile
              applications. Keeping Cebu clean, one sensor at a time.
            </p>
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <MapPin className="w-4 h-4" />
              Cebu City, Philippines
            </div>
          </div>

          {/* Spacer */}
          <div className="hidden md:block md:col-span-1" />

          {/* Links */}
          <div className="md:col-span-3">
            <h4 className="text-white font-bold text-sm mb-4 uppercase tracking-wider">
              Platform
            </h4>
            <ul className="space-y-3">
              {[
                { label: "Features", id: "features" },
                { label: "How It Works", id: "how-it-works" },
                { label: "Roles", id: "roles" },
                { label: "Download", id: "download" },
                { label: "About", id: "about" },
              ].map((link) => (
                <li key={link.id}>
                  <button
                    onClick={() => scrollTo(link.id)}
                    className="text-gray-400 hover:text-green-400 text-sm transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="md:col-span-3">
            <h4 className="text-white font-bold text-sm mb-4 uppercase tracking-wider">
              System
            </h4>
            <ul className="space-y-3">
              {[
                "IoT Sensors",
                "Mobile App",
                "Admin Panel",
                "Officials Portal",
              ].map((item) => (
                <li key={item}>
                  <span className="text-gray-500 text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-green-900/25 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-600 text-sm">
            © 2026 G-TRASH. Smart Waste Monitoring System. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/Cmhanz99"
              target="_blank"
              rel="noreferrer"
              className="text-gray-600 hover:text-green-400 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </a>
            <a
              href="mailto:hanz@washmywindows.com"
              className="text-gray-600 hover:text-green-400 transition-colors"
            >
              <Mail className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
