"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Sparkles, Calendar, Gift, Trophy, Bell } from "lucide-react";

export interface Novedad {
  id_novedad: string;
  titulo: string;
  contenido: string;
  tipo: "noticia" | "oferta" | "evento" | "campeonato";
  imagen_url?: string | null;
  publicado_en: string;
}

interface PromoCarouselProps {
  novedades?: Novedad[] | null;
}

const DEFAULT_PROMOS: Novedad[] = [
  {
    id_novedad: "demo-1",
    titulo: "¡Torneo Relámpago de Pool los Viernes!",
    contenido: "Inscríbete y demuestra quién manda en la mesa. Gran premio en efectivo y cerveza de cortesía para los participantes. Inscripción abierta desde el perfil.",
    tipo: "campeonato",
    imagen_url: "https://images.unsplash.com/photo-1575553939928-d03b21323afe?w=1600&q=80",
    publicado_en: new Date().toISOString()
  },
  {
    id_novedad: "demo-2",
    titulo: "Promo 2x1 en Alitas BBQ",
    contenido: "Acompaña tus mejores tiros con nuestra promo estrella. Válido todos los miércoles a partir de las 6:00 PM. Pide desde el código QR en tu mesa.",
    tipo: "oferta",
    imagen_url: "https://images.unsplash.com/photo-1544281153-6603be88b354?w=1600&q=80",
    publicado_en: new Date().toISOString()
  },
  {
    id_novedad: "demo-3",
    titulo: "Noche de Carambola de 3 Bandas",
    contenido: "Todos los jueves ven a perfeccionar tus efectos con mesas profesionales. Clases gratuitas impartidas por nuestro campeón residente de 7:00 PM a 9:00 PM.",
    tipo: "evento",
    imagen_url: "https://images.unsplash.com/photo-1589759118394-f5cfe6178fd3?w=1600&q=80",
    publicado_en: new Date().toISOString()
  }
];

export default function PromoCarousel({ novedades }: PromoCarouselProps) {
  const list = novedades && novedades.length > 0 ? novedades : DEFAULT_PROMOS;
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % list.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [list.length]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrent((prev) => (prev - 1 + list.length) % list.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrent((prev) => (prev + 1) % list.length);
  };

  const getBadgeIcon = (tipo: Novedad["tipo"]) => {
    switch (tipo) {
      case "campeonato":
        return <Trophy className="w-3.5 h-3.5" />;
      case "oferta":
        return <Gift className="w-3.5 h-3.5" />;
      case "evento":
        return <Calendar className="w-3.5 h-3.5" />;
      default:
        return <Bell className="w-3.5 h-3.5" />;
    }
  };

  const getBadgeStyle = (tipo: Novedad["tipo"]) => {
    switch (tipo) {
      case "campeonato":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "oferta":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "evento":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default:
        return "bg-billar-primary/20 text-billar-primary border-billar-primary/30";
    }
  };

  const getBadgeLabel = (tipo: Novedad["tipo"]) => {
    switch (tipo) {
      case "campeonato":
        return "Campeonato";
      case "oferta":
        return "Oferta";
      case "evento":
        return "Evento";
      default:
        return "Novedad";
    }
  };

  const currentItem = list[current];

  return (
    <div className="w-full relative group bg-black h-[70vh] md:h-[85vh]">
      {/* Left/Right Navigation Arrows on Edges */}
      <div className="absolute inset-y-0 left-4 md:left-8 flex items-center z-20">
        <button 
          onClick={handlePrev}
          className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-white/50 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-6 h-6 md:w-8 md:h-8" />
        </button>
      </div>
      <div className="absolute inset-y-0 right-4 md:right-8 flex items-center z-20">
        <button 
          onClick={handleNext}
          className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-white/50 hover:text-white transition-colors"
        >
          <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
        </button>
      </div>

      {/* Background Image */}
      <div className="absolute inset-0 w-full h-full">
        {currentItem.imagen_url && (
          <Image
            src={currentItem.imagen_url}
            alt="Fondo borroso"
            fill
            className="object-cover blur-3xl opacity-20 scale-110"
          />
        )}
        {currentItem.imagen_url ? (
          <Image
            src={currentItem.imagen_url}
            alt={currentItem.titulo}
            fill
            className="object-cover md:object-contain transition-transform duration-1000 ease-out group-hover:scale-[1.02]"
            priority
          />
        ) : (
          <div className="w-full h-full bg-[#0a0a0a] flex items-center justify-center">
            <Sparkles className="w-24 h-24 text-white/10" />
          </div>
        )}
        {/* Subtle Vignette / Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* Content Overlay (Centered at Bottom) */}
      <div className="absolute inset-0 flex flex-col justify-end items-center px-12 md:px-24 pb-20 md:pb-28 max-w-7xl mx-auto w-full z-10 text-center pointer-events-none">
        <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-5 duration-700 pointer-events-auto" key={current}>

          <div className="flex justify-center mb-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] md:text-xs font-semibold uppercase tracking-wider backdrop-blur-sm ${getBadgeStyle(currentItem.tipo)}`}>
              {getBadgeIcon(currentItem.tipo)}
              {getBadgeLabel(currentItem.tipo)}
            </span>
          </div>

          <h2 className="text-2xl md:text-4xl lg:text-4xl font-bold text-white leading-tight tracking-tight mb-2 drop-shadow-2xl">
            {currentItem.titulo}
          </h2>
          
          <p className="text-xs md:text-sm text-white/80 font-medium mb-6 max-w-lg mx-auto drop-shadow-md line-clamp-2 md:line-clamp-none">
            {currentItem.contenido}
          </p>

          <div className="flex justify-center">
            <button className="bg-billar-primary hover:bg-[#b81d24] text-white px-8 py-3 rounded-full text-sm md:text-base font-bold tracking-wide transition-all duration-300 shadow-[0_0_20px_rgba(220,38,38,0.45)] hover:scale-105 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Ver Detalles
            </button>
          </div>
        </div>
      </div>

      {/* Progress Indicators */}
      <div className="absolute bottom-6 left-0 w-full flex justify-center gap-2 z-20">
        {list.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              idx === current ? "w-8 bg-white" : "w-2 bg-white/30 hover:bg-white/60"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
