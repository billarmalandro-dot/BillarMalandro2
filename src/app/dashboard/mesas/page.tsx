"use client";

import { useState, useEffect } from "react";
import { 
  CircleDot, Play, Square, Timer, PlusCircle, AlertCircle, 
  HelpCircle, RefreshCw, Layers, Banknote, User, Clock, Check,
  X, Plus, Minus, ShoppingCart, Tag, Coffee, Settings, Edit2, 
  Archive, Power, Printer, Lock, Search
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { printReceipt } from "@/utils/printReceipt";

interface Mesa {
  id_mesa: string;
  numero: number;
  nombre: string | null;
  tipo: 'pool' | 'snooker' | 'americana' | 'carambola' | 'cacho';
  activo: boolean;
  id_sucursal?: string;
}

interface Tarifa {
  id_tarifa: string;
  nombre: string;
  precio_hora: number;
  tipo_dia: string;
  horas_pagadas?: number;
  horas_regalo?: number;
  descripcion?: string;
  es_promocion?: boolean;
  dias_semana?: number[];
  fecha_inicio?: string;
  fecha_fin?: string;
  precio_fijo?: number;
  personas?: number;
  productos_incluidos?: any[];
}

interface SesionMesa {
  id_sesion: string;
  id_mesa: string;
  id_tarifa: string;
  id_usuario: string;
  inicio: string;
  estado: 'abierta' | 'cerrada' | 'cancelada';
  modalidad: 'abierto' | 'fijo' | 'partida';
  tiempo_fijo_minutos: number;
  costo_partida: number;
  tarifas?: Tarifa;
}

interface Producto {
  id_producto: string;
  id_categoria: string;
  nombre: string;
  precio_venta: number;
  imagen_url?: string;
}

interface Categoria {
  id_categoria: string;
  nombre: string;
}

interface VentaItem {
  id_venta_item: string;
  id_producto: string;
  producto?: Producto;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

interface VentaPendiente {
  id_venta: string;
  items: VentaItem[];
}

export default function MesasPage() {
  const [loading, setLoading] = useState(true);
  const [dbStateError, setDbStateError] = useState("");
  
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [todasMesas, setTodasMesas] = useState<Mesa[]>([]); // Para el CRUD
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [globalConfig, setGlobalConfig] = useState<any>(null);
  const [sesionesActivas, setSesionesActivas] = useState<Record<string, SesionMesa>>({});
  
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeSucursalId, setActiveSucursalId] = useState<string>("");
  const [cajaAbierta, setCajaAbierta] = useState(true);

  // CRUD Mesas
  const [isManagingMesas, setIsManagingMesas] = useState(false);
  const [isEditingMesa, setIsEditingMesa] = useState(false);
  const [mesaFormData, setMesaFormData] = useState<Partial<Mesa>>({ numero: 1, nombre: "", tipo: 'pool' });

  // Modal Abrir Sesión
  const [isOpeningSession, setIsOpeningSession] = useState(false);
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [selectedTarifaId, setSelectedTarifaId] = useState("");
  
  // Modalidades de Juego
  const [modalidad, setModalidad] = useState<'abierto'|'fijo'|'partida'>('abierto');
  const [tiempoFijoMinutos, setTiempoFijoMinutos] = useState<number>(60);
  const [costoPartida, setCostoPartida] = useState<number>(5.00);

  // POS / Cuenta
  const [isPosOpen, setIsPosOpen] = useState(false);
  const [posMesa, setPosMesa] = useState<Mesa | null>(null);
  const [posSesion, setPosSesion] = useState<SesionMesa | null>(null);
  const [posVenta, setPosVenta] = useState<VentaPendiente | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchProductoQuery, setSearchProductoQuery] = useState("");
  
  const [isClosingSession, setIsClosingSession] = useState(false);
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'qr'>('efectivo');

  const [currentTime, setCurrentTime] = useState(new Date());
  const supabase = createClient();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { loadData(); }, []);

  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setDbStateError("");
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("No hay usuario autenticado.");
      
      const { data: dbUser } = await supabase
        .from("usuarios")
        .select("id_usuario, nombre, roles(nombre, nivel), usuario_sucursal(id_sucursal)")
        .eq("auth_id", user.id)
        .single();
      
      setCurrentUser(dbUser);

      // Obtener la sucursal del empleado
      const usObj = dbUser?.usuario_sucursal && (Array.isArray(dbUser.usuario_sucursal) ? dbUser.usuario_sucursal[0] : dbUser.usuario_sucursal);
      const userAssignedSucursalId = usObj?.id_sucursal || "";

      const { data: sucursales } = await supabase.from("sucursales").select("id_sucursal");
      const sucursalId = userAssignedSucursalId || sucursales?.[0]?.id_sucursal || "";
      setActiveSucursalId(sucursalId);

      // Mesas (Todas para CRUD) filtradas por la sucursal activa
      const { data: mesasAll } = await supabase
        .from("mesas")
        .select("*")
        .eq("id_sucursal", sucursalId)
        .order("numero");
      setTodasMesas(mesasAll || []);

      // Mesas (Activas para Grid)
      setMesas((mesasAll || []).filter(m => m.activo));

      // Sugerir el siguiente número disponible para una mesa NUEVA (evita choque con UNIQUE)
      const nextNum = (mesasAll && mesasAll.length > 0)
        ? Math.max(...mesasAll.map(m => m.numero || 0)) + 1
        : 1;
      setMesaFormData(prev => prev.id_mesa ? prev : { ...prev, numero: nextNum });

      // Verificar si la caja está abierta
      const { data: cajas } = await supabase.from("cajas").select("id_caja").eq("id_sucursal", sucursalId).eq("activo", true).limit(1).maybeSingle();
      if (cajas && dbUser) {
        const rolesData = dbUser.roles;
        const rolesObj = Array.isArray(rolesData) ? rolesData[0] : rolesData;
        const userLevel = rolesObj?.nivel || 1;

        let arqueoQuery = supabase
          .from("arqueos")
          .select("*")
          .eq("id_caja", cajas.id_caja)
          .eq("tipo", "apertura");

        if (userLevel < 4) {
          // Si es cajero/mesero (nivel < 4), buscar su propia apertura
          arqueoQuery = arqueoQuery.eq("id_usuario", dbUser.id_usuario);
        }

        const { data: lastArqueo } = await arqueoQuery
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastArqueo) {
          // Buscar si hay un cierre posterior a esta apertura (sin importar quién lo cerró)
          const { data: cierrePost } = await supabase
            .from("arqueos")
            .select("*")
            .eq("id_caja", cajas.id_caja)
            .eq("tipo", "cierre")
            .gt("created_at", lastArqueo.created_at)
            .limit(1)
            .maybeSingle();

          setCajaAbierta(!cierrePost);
        } else {
          setCajaAbierta(false);
        }
      } else {
        setCajaAbierta(false);
      }

      // Tarifas y Configuración
      const { data: tarifasData } = await supabase.from("tarifas").select("*").eq("id_sucursal", sucursalId).eq("activo", true);
      setTarifas(tarifasData || []);
      if (tarifasData && tarifasData.length > 0) setSelectedTarifaId(tarifasData[0].id_tarifa);

      const { data: confData } = await supabase.from("configuracion").select("*").limit(1).maybeSingle();
      setGlobalConfig(confData);

      // Sesiones Activas
      const { data: sesionesData } = await supabase
        .from("sesiones_mesa")
        .select(`id_sesion, id_mesa, id_tarifa, id_usuario, inicio, estado, modalidad, tiempo_fijo_minutos, costo_partida`)
        .eq("estado", "abierta");

      const activeRecord: Record<string, SesionMesa> = {};
      if (sesionesData) {
        sesionesData.forEach((sesion: any) => { activeRecord[sesion.id_mesa] = sesion; });
      }
      setSesionesActivas(activeRecord);

      // Productos
      const { data: catData } = await supabase.from("categorias").select("*");
      if (catData) setCategorias(catData);
      const { data: prodData } = await supabase.from("productos").select("*").eq("activo", true);
      if (prodData) setProductos(prodData);

    } catch (err: any) {
      setDbStateError(err.message || "Error al conectar con la base de datos.");
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  // ----- CRUD de Mesas -----
  const handleSaveMesa = async () => {
    if (!activeSucursalId) {
      alert("No hay una sucursal activa. Crea o asígnate una sucursal antes de agregar mesas.");
      return;
    }
    const numero = Number(mesaFormData.numero);
    if (!numero || numero <= 0) {
      alert("Ingresa un número de mesa válido (mayor a 0).");
      return;
    }
    try {
      const payload = {
        id_sucursal: activeSucursalId,
        numero,
        nombre: mesaFormData.nombre || `Mesa ${numero}`,
        tipo: mesaFormData.tipo || 'pool',
        activo: mesaFormData.activo !== undefined ? mesaFormData.activo : true
      };

      // Supabase NO lanza excepción: hay que revisar el { error } que retorna.
      const { error } = mesaFormData.id_mesa
        ? await supabase.from("mesas").update(payload).eq("id_mesa", mesaFormData.id_mesa)
        : await supabase.from("mesas").insert(payload);

      if (error) {
        if (error.code === "23505") {
          alert(`Ya existe una mesa con el número ${numero} en esta sucursal. Usa otro número.`);
        } else {
          alert("Error guardando mesa: " + error.message);
        }
        return;
      }

      setMesaFormData({ numero: 1, nombre: "", tipo: 'pool' });
      setIsEditingMesa(false);
      await loadData();
    } catch (err: any) {
      alert("Error guardando mesa: " + err.message);
    }
  };

  const handleToggleEstadoMesa = async (mesa: Mesa) => {
    try {
      const { error } = await supabase.from("mesas").update({ activo: !mesa.activo }).eq("id_mesa", mesa.id_mesa);
      if (error) { alert("Error cambiando estado: " + error.message); return; }
      await loadData();
    } catch (err: any) {
      alert("Error cambiando estado: " + err.message);
    }
  };

  // ----- Apertura de Sesión -----
  const handleOpenSessionClick = (mesa: Mesa) => {
    setSelectedMesa(mesa);
    setModalidad('abierto');
    setTiempoFijoMinutos(60);
    setCostoPartida(5.00);
    setIsOpeningSession(true);
  };

  const handleConfirmStart = async () => {
    if (!selectedMesa || !selectedTarifaId || !currentUser || !activeSucursalId) return;

    try {
      const { data, error } = await supabase
        .from("sesiones_mesa")
        .insert({
          id_mesa: selectedMesa.id_mesa,
          id_tarifa: selectedTarifaId,
          id_usuario: currentUser.id_usuario,
          id_sucursal: activeSucursalId,
          inicio: new Date().toISOString(),
          estado: "abierta",
          modalidad: modalidad,
          tiempo_fijo_minutos: tiempoFijoMinutos,
          costo_partida: costoPartida
        })
        .select()
        .single();

      if (error) {
        if (error.message.includes("column \"modalidad\" of relation")) {
          throw new Error("Falta ejecutar el script SQL para actualizar la tabla sesiones_mesa con las nuevas modalidades.");
        }
        throw error;
      }

      setSesionesActivas(prev => ({ ...prev, [selectedMesa.id_mesa]: data }));
      setIsOpeningSession(false);
      setSelectedMesa(null);
    } catch (err: any) {
      alert("Error al iniciar sesión: " + err.message);
    }
  };

  // ----- Lógica del Punto de Venta (POS) -----
  const openPos = async (mesa: Mesa, sesion: SesionMesa) => {
    setPosMesa(mesa);
    setPosSesion(sesion);
    setIsPosOpen(true);
    setPosVenta(null);

    const { data: ventaData } = await supabase
      .from("ventas")
      .select("id_venta, estado")
      .eq("id_sesion", sesion.id_sesion)
      .eq("estado", "pendiente")
      .maybeSingle(); 

    if (ventaData) {
      const { data: itemsData } = await supabase
        .from("venta_items")
        .select("*, producto:productos(*)")
        .eq("id_venta", ventaData.id_venta);

      setPosVenta({ id_venta: ventaData.id_venta, items: itemsData || [] });
    }
  };

  const handleAddTime = async (minutesToAdd: number) => {
    if (!posSesion || posSesion.modalidad !== 'fijo') return;
    
    const currentMinutes = posSesion.tiempo_fijo_minutos || 60;
    const newMinutes = currentMinutes + minutesToAdd;
    
    const { error } = await supabase
      .from("sesiones_mesa")
      .update({ tiempo_fijo_minutos: newMinutes })
      .eq("id_sesion", posSesion.id_sesion);
      
    if (!error) {
      setPosSesion({ ...posSesion, tiempo_fijo_minutos: newMinutes });
      loadData(true);
    } else {
      alert("Error al agregar tiempo: " + error.message);
    }
  };

  const handleConvertToAbierto = async () => {
    if (!posSesion) return;
    
    const { error } = await supabase
      .from("sesiones_mesa")
      .update({ modalidad: "abierto" })
      .eq("id_sesion", posSesion.id_sesion);
      
    if (!error) {
      setPosSesion({ ...posSesion, modalidad: "abierto" });
      loadData(true);
    } else {
      alert("Error al cambiar la modalidad: " + error.message);
    }
  };

  // Helper: recarga todos los items de una venta desde la BD
  const reloadVentaItems = async (ventaId: string) => {
    const { data: itemsData } = await supabase
      .from("venta_items")
      .select("*, producto:productos(*)")
      .eq("id_venta", ventaId);
    return itemsData || [];
  };

  const handleAddProduct = async (prod: Producto) => {
    if (!posMesa || !posSesion || !currentUser || !activeSucursalId) return;

    let currentVentaId = posVenta?.id_venta;

    if (!currentVentaId) {
      // Prevenir duplicidad de ventas concurrentes verificando primero
      const { data: existingVenta } = await supabase
        .from("ventas")
        .select("id_venta")
        .eq("id_sesion", posSesion.id_sesion)
        .eq("estado", "pendiente")
        .maybeSingle();

      if (existingVenta) {
        currentVentaId = existingVenta.id_venta;
      } else {
        const { data: newVenta, error: createError } = await supabase
          .from("ventas")
          .insert({
            id_sucursal: activeSucursalId,
            id_sesion: posSesion.id_sesion,
            id_usuario: currentUser.id_usuario,
            estado: "pendiente",
            total: 0
          })
          .select()
          .single();
        
        if (createError) { alert("Error al crear cuenta: " + createError.message); return; }
        currentVentaId = newVenta!.id_venta;
      }
    }

    const existingItem = posVenta?.items?.find(i => i.id_producto === prod.id_producto);

    if (existingItem) {
      const newCant = Number(existingItem.cantidad) + 1;
      const { data, error } = await supabase
        .from("venta_items")
        .update({ cantidad: newCant })
        .eq("id_venta_item", existingItem.id_venta_item)
        .select();

      if (error) { alert("Error al agregar cantidad: " + error.message); return; }
      if (!data || data.length === 0) { alert("No se pudo actualizar el producto. Verifica los permisos de la base de datos."); return; }
    } else {
      const { error } = await supabase
        .from("venta_items")
        .insert({
          id_venta: currentVentaId,
          id_producto: prod.id_producto,
          cantidad: 1,
          precio_unitario: prod.precio_venta
        });
      
      if (error) { alert("Error al agregar producto: " + error.message); return; }
    }

    // Recargar TODOS los items frescos de la BD
    const freshItems = await reloadVentaItems(currentVentaId as string);
    setPosVenta({ id_venta: currentVentaId as string, items: freshItems });
  };

  const handleRemoveProduct = async (item: VentaItem) => {
    if (!posVenta) return;

    if (Number(item.cantidad) > 1) {
      const newCant = Number(item.cantidad) - 1;
      const { data, error } = await supabase
        .from("venta_items")
        .update({ cantidad: newCant })
        .eq("id_venta_item", item.id_venta_item)
        .select();

      if (error) { alert("Error al restar producto: " + error.message); return; }
      if (!data || data.length === 0) { alert("No se pudo actualizar el producto. Verifica los permisos de la base de datos."); return; }
    } else {
      const { data, error } = await supabase
        .from("venta_items")
        .delete()
        .eq("id_venta_item", item.id_venta_item)
        .select();
      
      if (error) { alert("Error al eliminar producto: " + error.message); return; }
      if (!data || data.length === 0) { alert("No se pudo eliminar el producto. Verifica los permisos de la base de datos."); return; }
    }

    // Recargar TODOS los items frescos de la BD
    const freshItems = await reloadVentaItems(posVenta.id_venta);
    setPosVenta({ id_venta: posVenta.id_venta, items: freshItems });
  };

  // ----- Cálculos Dinámicos de Sesión -----
  const getSessionDetails = (sesion: SesionMesa) => {
    if (!sesion) return { timeString: "00:00:00", accumulatedValue: "0.00", tarifaNombre: "Normal", diffSecs: 0, isTimeUp: false };
    
    const isFijo = sesion.modalidad === 'fijo';
    const isPartida = sesion.modalidad === 'partida';
    
    const inicio = new Date(sesion.inicio);
    const diffMs = currentTime.getTime() - inicio.getTime();
    const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
    
    const tarifa = tarifas.find(t => t.id_tarifa === sesion.id_tarifa);
    const tarifaNombre = tarifa ? tarifa.nombre : "Tarifa Normal";
    const fallbackPrecio = globalConfig?.tarifa_hora_mesa ? Number(globalConfig.tarifa_hora_mesa) : 30.00;
    const precioHora = tarifa ? Number(tarifa.precio_hora) : fallbackPrecio;

    let timeString = "00:00:00";
    let accumulatedValue = "0.00";
    let isTimeUp = false;
    
    // Promo vars
    const pagadas = Number(tarifa?.horas_pagadas || 0);
    const regalo = Number(tarifa?.horas_regalo || 0);
    const bloque = pagadas + regalo;
    let horasRegaloPromo = 0;

    if (isPartida) {
      timeString = "--:--:--";
      accumulatedValue = Number(sesion.costo_partida || 0).toFixed(2);
    } else if (isFijo) {
      const totalSecs = (sesion.tiempo_fijo_minutos || 60) * 60;
      let remaining = totalSecs - diffSecs;
      if (remaining <= 0) {
        remaining = 0;
        isTimeUp = true;
      }
      
      const hrs = Math.floor(remaining / 3600);
      const mins = Math.floor((remaining % 3600) / 60);
      const secs = remaining % 60;
      timeString = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      
      const costoFijo = ((sesion.tiempo_fijo_minutos || 60) / 60) * precioHora;
      accumulatedValue = costoFijo.toFixed(2);
    } else {
      const hrs = Math.floor(diffSecs / 3600);
      const mins = Math.floor((diffSecs % 3600) / 60);
      const secs = diffSecs % 60;
      timeString = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      
      const horasCompletas = diffSecs / 3600;
      let horasACobrar = horasCompletas;
      
      if (bloque > 0 && pagadas > 0 && horasCompletas >= bloque) {
        const numBloques = Math.floor(horasCompletas / bloque);
        horasRegaloPromo = numBloques * regalo;
        horasACobrar = horasCompletas - horasRegaloPromo;
      }
      
      accumulatedValue = (horasACobrar * precioHora).toFixed(2);
    }

    return {
      timeString,
      accumulatedValue,
      tarifaNombre: isPartida ? "Por Partida Fija" : tarifaNombre,
      diffSecs,
      isPartida,
      isFijo,
      isTimeUp,
      precioHora,
      horasRegaloPromo,
      horaInicio: inicio.toLocaleString("es-BO", { hour12: false })
    };
  };

  // ----- Cierre y Cobro -----
  const openCobroModal = () => setIsClosingSession(true);

  const handleConfirmClose = async () => {
    if (!posSesion || !posMesa || !currentUser || !activeSucursalId) return;

    try {
      const sessionDetails = getSessionDetails(posSesion);
      const totalTiempo = Number(sessionDetails.accumulatedValue);
      const horasTranscurridas = sessionDetails.diffSecs / 3600;

      const totalProductos = posVenta?.items.reduce((acc, item) => acc + item.subtotal, 0) || 0;
      const granTotal = totalTiempo + totalProductos;

      const { error: errorSesion } = await supabase
        .from("sesiones_mesa")
        .update({
          fin: new Date().toISOString(),
          total_tiempo: Number(horasTranscurridas.toFixed(2)),
          estado: "cerrada"
        })
        .eq("id_sesion", posSesion.id_sesion);

      if (errorSesion) {
        throw new Error("No se pudo cerrar la sesión en la base de datos: " + errorSesion.message);
      }

      if (posVenta?.id_venta) {
        const { error: errorVenta } = await supabase.from("ventas").update({
            total: granTotal,
            metodo_pago: metodoPago,
            estado: "completada",
            id_usuario: currentUser.id_usuario,
            created_at: new Date().toISOString()
        }).eq("id_venta", posVenta.id_venta);

        if (errorVenta) {
          throw new Error("No se pudo completar el registro de la venta: " + errorVenta.message);
        }
      } else {
        const { error: errorVentaInsert } = await supabase.from("ventas").insert({
            id_sucursal: activeSucursalId,
            id_sesion: posSesion.id_sesion,
            id_usuario: currentUser.id_usuario,
            total: granTotal,
            metodo_pago: metodoPago,
            estado: "completada"
        });

        if (errorVentaInsert) {
          throw new Error("No se pudo registrar la nueva venta en la base de datos: " + errorVentaInsert.message);
        }
      }

      const tarifaAplicada = tarifas.find(t => t.id_tarifa === posSesion.id_tarifa);
      const isPromo = tarifaAplicada?.es_promocion;
      const promoProducts = isPromo && tarifaAplicada.productos_incluidos ? tarifaAplicada.productos_incluidos : [];

      // Descontar productos de promo del inventario
      if (promoProducts.length > 0) {
        for (const prod of promoProducts) {
          const { data: invData, error: errorSelectInv } = await supabase
            .from("inventario")
            .select("id_inventario, stock")
            .eq("id_producto", prod.id_producto)
            .eq("id_sucursal", activeSucursalId)
            .single();
          
          if (errorSelectInv) {
            throw new Error(`Error al consultar inventario de promo para ${prod.nombre}: ` + errorSelectInv.message);
          }
          
          if (invData) {
            const { error: errorUpdateInv } = await supabase
              .from("inventario")
              .update({ stock: Math.max(0, invData.stock - (prod.cantidad || 1)) })
              .eq("id_inventario", invData.id_inventario);

            if (errorUpdateInv) {
              throw new Error(`Error al actualizar stock de promo para ${prod.nombre}: ` + errorUpdateInv.message);
            }
          }
        }
      }

      // Preparar datos para imprimir el recibo
      const receiptData = {
        tipo: "mesa" as const,
        mesaNumero: posMesa.numero,
        cajero: currentUser.nombre || "Cajero",
        tiempo: {
          horas: sessionDetails.timeString,
          costo: totalTiempo,
          tarifaNombre: sessionDetails.tarifaNombre + (isPromo ? " (PROMO)" : ""),
          horaInicio: sessionDetails.horaInicio,
          precioPorHora: sessionDetails.precioHora,
          horasRegaloPromo: sessionDetails.horasRegaloPromo
        },
        productos: [
          ...(posVenta?.items || []).map(i => ({
            nombre: i.producto?.nombre || "Producto",
            cantidad: i.cantidad,
            precio_unitario: i.precio_unitario,
            subtotal: i.cantidad * i.precio_unitario
          })),
          ...promoProducts.map(p => ({
            nombre: `[PROMO] ${p.nombre}`,
            cantidad: p.cantidad || 1,
            precio_unitario: 0,
            subtotal: 0
          }))
        ],
        totalGeneral: granTotal,
        metodoPago: metodoPago
      };

      printReceipt(receiptData);

      setSesionesActivas(prev => { const copy = { ...prev }; delete copy[posMesa.id_mesa]; return copy; });

      setIsClosingSession(false); setIsPosOpen(false); setPosSesion(null); setPosMesa(null); setPosVenta(null);
    } catch (err: any) {
      alert("Error al finalizar sesión: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-billar-gray">
        <RefreshCw className="w-10 h-10 animate-spin text-billar-primary mb-4" />
        <p className="text-sm">Cargando mesas y estado del salón...</p>
      </div>
    );
  }

  if (!cajaAbierta) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
          <Lock className="w-12 h-12 text-billar-primary" />
        </div>
        <h2 className="text-3xl font-black text-white mb-3">Caja Cerrada</h2>
        <p className="text-billar-gray text-center max-w-md mb-8">
          Por razones de seguridad, no puedes interactuar con las mesas ni realizar ventas hasta que inicies tu turno y abras la caja.
        </p>
        <a href="/dashboard/caja" className="px-8 py-3 bg-billar-primary hover:bg-billar-primary-dark text-white font-bold rounded-xl flex items-center gap-2 shadow-[0_0_20px_rgba(220, 38, 38,0.4)] transition-all">
          Ir a Abrir Caja
        </a>
      </div>
    );
  }

  const isAdmin = currentUser?.roles?.nivel >= 4;
  const isMesero = currentUser?.roles?.nivel < 2;
  const filteredProducts = productos.filter(p => 
    (activeCategory === 'all' || p.id_categoria === activeCategory) &&
    p.nombre.toLowerCase().includes(searchProductoQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <CircleDot className="w-7 h-7 text-billar-primary" />
            Control de Mesas
          </h2>
          <p className="text-sm text-billar-gray">Abre mesas, elige modalidades y cobra en tiempo real.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => loadData()} className="flex items-center gap-2 px-4 py-2 border border-[#2a2a2c] hover:bg-[#2a2a2c] text-white rounded-lg text-sm transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
          {isAdmin && (
            <button 
              onClick={() => setIsManagingMesas(true)}
              className="flex items-center gap-2 px-4 py-2 bg-billar-primary hover:bg-billar-primary-dark text-white rounded-lg text-sm font-bold transition-all shadow-[0_0_15px_rgba(220, 38, 38,0.2)]"
            >
              <Settings className="w-4 h-4" /> Gestionar Mesas
            </button>
          )}
        </div>
      </div>

      {dbStateError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <p className="text-sm font-bold">{dbStateError}</p>
        </div>
      )}

      {/* Grid de Mesas Visuales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-x-8 gap-y-12 mt-6 pb-6">
        {mesas.map((mesa) => {
          const sesion = sesionesActivas[mesa.id_mesa];
          const isEnUso = !!sesion;
          const { timeString, accumulatedValue, tarifaNombre, isTimeUp, isPartida } = isEnUso 
            ? getSessionDetails(sesion) 
            : { timeString: "", accumulatedValue: "0.00", tarifaNombre: "", isTimeUp: false, isPartida: false };

          return (
            <div 
              key={mesa.id_mesa} 
              className={`relative p-3 rounded-[2rem] bg-neutral-900 shadow-2xl border-b-8 transition-all duration-300 aspect-[4/3] flex flex-col group ${
                isEnUso ? "border-neutral-950 scale-[1.02] shadow-[0_20px_40px_rgba(220, 38, 38,0.15)]" : "border-neutral-950 hover:scale-[1.02]"
              }`}
            >
              <div className={`relative w-full h-full flex flex-col justify-center items-center overflow-hidden transition-colors duration-700
                ${mesa.tipo === 'cacho' 
                  ? 'bg-neutral-800 p-2 [clip-path:polygon(15%_0%,_85%_0%,_100%_15%,_100%_85%,_85%_100%,_15%_100%,_0%_85%,_0%_15%)]' 
                  : 'rounded-[1.25rem] border-[6px] border-neutral-800'} 
                ${mesa.tipo !== 'cacho' && isEnUso ? (isTimeUp ? "bg-orange-800" : "bg-billar-primary/90") : ""}
                ${mesa.tipo !== 'cacho' && !isEnUso ? "bg-emerald-800/90" : ""}
              `}>
                
                {/* Fondo Interior */}
                <div className={`absolute inset-0 z-0 ${
                   mesa.tipo === 'cacho'
                    ? 'm-[6px] [clip-path:polygon(15%_0%,_85%_0%,_100%_15%,_100%_85%,_85%_100%,_15%_100%,_0%_85%,_0%_15%)] ' + (isEnUso ? (isTimeUp ? "bg-orange-800" : "bg-billar-primary/90") : "bg-emerald-800/90")
                    : 'bg-transparent'
                }`}>
                   <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/20 to-transparent mix-blend-overlay"></div>
                </div>

                {mesa.tipo !== 'cacho' && (
                  <>
                    {/* Troneras */}
                    <div className="absolute -top-3 -left-3 w-8 h-8 bg-[#0a0a0a] rounded-full shadow-[inset_0_4px_8px_rgba(0,0,0,1)] z-0"></div>
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-8 bg-[#0a0a0a] rounded-full shadow-[inset_0_4px_8px_rgba(0,0,0,1)] z-0"></div>
                    <div className="absolute -top-3 -right-3 w-8 h-8 bg-[#0a0a0a] rounded-full shadow-[inset_0_4px_8px_rgba(0,0,0,1)] z-0"></div>
                    <div className="absolute -bottom-3 -left-3 w-8 h-8 bg-[#0a0a0a] rounded-full shadow-[inset_0_4px_8px_rgba(0,0,0,1)] z-0"></div>
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-8 h-8 bg-[#0a0a0a] rounded-full shadow-[inset_0_4px_8px_rgba(0,0,0,1)] z-0"></div>
                    <div className="absolute -bottom-3 -right-3 w-8 h-8 bg-[#0a0a0a] rounded-full shadow-[inset_0_4px_8px_rgba(0,0,0,1)] z-0"></div>

                    <div className="absolute left-1/4 top-0 bottom-0 w-[1px] bg-white/10 z-0 hidden sm:block"></div>
                    <div className="absolute left-1/4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/20 z-0 hidden sm:block"></div>
                  </>
                )}

                {mesa.tipo === 'cacho' && (
                  <>
                    <div className="absolute top-[8%] left-[25%] w-6 h-6 bg-black/80 rounded-full shadow-inner z-0"></div>
                    <div className="absolute top-[8%] right-[25%] w-6 h-6 bg-black/80 rounded-full shadow-inner z-0"></div>
                    <div className="absolute bottom-[8%] left-[25%] w-6 h-6 bg-black/80 rounded-full shadow-inner z-0"></div>
                    <div className="absolute bottom-[8%] right-[25%] w-6 h-6 bg-black/80 rounded-full shadow-inner z-0"></div>
                    <div className="absolute top-[50%] left-[4%] -translate-y-1/2 w-6 h-6 bg-black/80 rounded-full shadow-inner z-0"></div>
                    <div className="absolute top-[50%] right-[4%] -translate-y-1/2 w-6 h-6 bg-black/80 rounded-full shadow-inner z-0"></div>
                  </>
                )}

                <div className="z-10 bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl p-2 sm:p-3 flex flex-col items-center justify-center w-[85%] text-center shadow-2xl transition-all h-[80%] overflow-hidden">
                  <h3 className="font-black text-white text-base sm:text-xl uppercase tracking-widest mb-0 line-clamp-1">{mesa.nombre || `Mesa ${mesa.numero}`}</h3>
                  <span className="text-[9px] sm:text-[10px] text-white/70 uppercase font-bold tracking-widest mb-2">{mesa.tipo}</span>
                  
                  {isEnUso ? (
                    <div className="w-full border-t border-white/20 pt-2 flex flex-col items-center justify-center">
                      <div className="flex items-center justify-center gap-1.5 mb-0.5">
                         {isPartida ? (
                           <Check className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                         ) : (
                           <Timer className={`w-3 h-3 sm:w-4 sm:h-4 text-white ${isTimeUp ? 'animate-bounce text-orange-400' : 'animate-pulse'}`} />
                         )}
                         <span className={`font-mono text-lg sm:text-2xl font-bold tracking-wider drop-shadow-md ${isTimeUp ? 'text-orange-400' : 'text-white'}`}>
                           {isTimeUp ? "¡TIEMPO!" : timeString}
                         </span>
                      </div>
                      
                      <div className="flex items-center justify-center gap-1 text-[8px] sm:text-[10px] text-white/60 font-bold mb-0.5 bg-black/30 px-2 py-0.5 rounded-full">
                        <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        Inició: {new Date(sesion.inicio).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                      </div>

                      <div className="text-white/50 text-[8px] sm:text-[9px] uppercase tracking-wider mb-0.5 truncate w-full">{tarifaNombre}</div>
                      <div className="text-white font-black text-base sm:text-xl drop-shadow-md">
                        Bs. {accumulatedValue}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full border-t border-white/10 pt-2 flex items-center justify-center gap-2 text-white/50">
                      <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Mesa Libre</span>
                    </div>
                  )}
                </div>
              </div>

              {isEnUso ? (
                <button 
                  onClick={() => openPos(mesa, sesion)} 
                  className={`absolute -bottom-5 left-1/2 -translate-x-1/2 px-6 py-2.5 font-black text-sm uppercase rounded-full shadow-[0_10px_20px_rgba(0,0,0,0.5)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border z-20 whitespace-nowrap ${isTimeUp ? 'bg-orange-500 text-white border-orange-400 animate-pulse' : 'bg-white text-black border-white/20 hover:bg-neutral-200'}`}
                >
                  <ShoppingCart className="w-4 h-4" /> Ver Cuenta
                </button>
              ) : (
                <button 
                  disabled={isMesero}
                  onClick={() => handleOpenSessionClick(mesa)} 
                  className={`absolute -bottom-5 left-1/2 -translate-x-1/2 px-6 py-2.5 font-black text-sm uppercase rounded-full shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-all flex items-center gap-2 border z-20 whitespace-nowrap ${
                    isMesero 
                      ? 'bg-[#1a1a1c] text-billar-gray/50 border-[#2a2a2c] cursor-not-allowed' 
                      : 'bg-[#2a2a2c] text-white hover:bg-white hover:text-black hover:scale-105 active:scale-95 border-[#3a3a3c] hover:border-white'
                  }`}
                >
                  {isMesero ? <span>Disponible</span> : <><Play className="w-4 h-4" /> Abrir Mesa</>}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* --- MODAL: Abrir Sesión con Modalidades --- */}
      {isOpeningSession && selectedMesa && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1c] border border-[#2a2a2c] w-full max-w-lg rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-[#2a2a2c] flex justify-between items-center bg-black/20 shrink-0">
              <div>
                <h3 className="font-bold text-lg text-white">Abrir {selectedMesa.nombre || `Mesa ${selectedMesa.numero}`}</h3>
                <p className="text-xs text-billar-gray uppercase">Configuración de Partida</p>
              </div>
              <button onClick={() => { setIsOpeningSession(false); setSelectedMesa(null); }} className="text-billar-gray hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-[#2a2a2c]">
              {/* Selector de Modalidad */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-billar-gray uppercase tracking-wider block">Modalidad de Juego</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button onClick={() => setModalidad('abierto')} className={`p-3 rounded-xl border text-center transition-all ${modalidad === 'abierto' ? 'bg-billar-primary/10 border-billar-primary text-white' : 'bg-black/20 border-[#2a2a2c] text-billar-gray'}`}>
                    <Timer className="w-5 h-5 mx-auto mb-1" />
                    <span className="text-xs font-bold block">T. Libre</span>
                  </button>
                  <button onClick={() => setModalidad('fijo')} className={`p-3 rounded-xl border text-center transition-all ${modalidad === 'fijo' ? 'bg-billar-primary/10 border-billar-primary text-white' : 'bg-black/20 border-[#2a2a2c] text-billar-gray'}`}>
                    <Clock className="w-5 h-5 mx-auto mb-1" />
                    <span className="text-xs font-bold block">T. Fijo</span>
                  </button>
                  <button onClick={() => setModalidad('partida')} className={`p-3 rounded-xl border text-center transition-all ${modalidad === 'partida' ? 'bg-billar-primary/10 border-billar-primary text-white' : 'bg-black/20 border-[#2a2a2c] text-billar-gray'}`}>
                    <CircleDot className="w-5 h-5 mx-auto mb-1" />
                    <span className="text-xs font-bold block">Por Ficha</span>
                  </button>
                </div>
              </div>

              {/* Ajustes Específicos según Modalidad */}
              {modalidad === 'abierto' && (
                <div className="bg-black/20 p-4 rounded-xl border border-[#2a2a2c]">
                  <p className="text-sm text-billar-gray">El reloj contará hacia adelante. El costo se calculará por minuto según la tarifa elegida abajo.</p>
                </div>
              )}

              {modalidad === 'fijo' && (
                <div className="bg-black/20 p-4 rounded-xl border border-billar-primary/30 space-y-3 animate-in slide-in-from-top-2">
                  <label className="text-xs font-bold text-white uppercase tracking-wider block">Tiempo Pre-pagado (Minutos)</label>
                  <div className="flex gap-2">
                    {[30, 60, 90, 120].map(min => (
                      <button key={min} onClick={() => setTiempoFijoMinutos(min)} className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${tiempoFijoMinutos === min ? 'bg-billar-primary text-white border-billar-primary' : 'bg-[#1a1a1c] text-billar-gray border-[#2a2a2c] hover:bg-[#2a2a2c]'}`}>{min}m</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-billar-gray text-sm">Personalizado:</span>
                    <input type="number" min="1" value={tiempoFijoMinutos} onChange={e => setTiempoFijoMinutos(parseInt(e.target.value) || 0)} className="w-20 bg-black border border-[#2a2a2c] rounded py-1 px-2 text-white outline-none focus:border-billar-primary text-center" />
                    <span className="text-billar-gray text-sm">min</span>
                  </div>
                </div>
              )}

              {modalidad === 'partida' && (
                <div className="bg-black/20 p-4 rounded-xl border border-billar-primary/30 space-y-3 animate-in slide-in-from-top-2">
                  <label className="text-xs font-bold text-white uppercase tracking-wider block">Costo Fijo por Partida</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-billar-gray">Bs.</span>
                    <input type="number" step="0.5" value={costoPartida} onChange={e => setCostoPartida(parseFloat(e.target.value) || 0)} className="w-full bg-black border border-[#2a2a2c] rounded-lg py-3 pl-10 pr-4 text-white text-lg font-bold outline-none focus:border-billar-primary" />
                  </div>
                  <p className="text-xs text-billar-gray">No se tomará en cuenta el tiempo ni la tarifa por hora elegida.</p>
                </div>
              )}

              {/* Selector de Tarifa con Promos Inteligentes */}
              <div className={`space-y-4 ${modalidad === 'partida' ? 'opacity-50 pointer-events-none' : ''}`}>
                <label className="text-xs font-bold text-white uppercase tracking-wider block border-b border-[#2a2a2c] pb-2">Tarifas y Promociones Disponibles</label>
                
                {(() => {
                  const today = new Date().getDay(); // 0 = Domingo, 1 = Lunes...
                  
                  // Filtrar tarifas que aplican hoy (si no tiene dias_semana, aplica siempre)
                  const tarifasValidas = tarifas.filter(t => {
                    if (!t.dias_semana || t.dias_semana.length === 0) return true;
                    return t.dias_semana.includes(today);
                  });

                  const tarifasNormales = tarifasValidas.filter(t => !t.es_promocion);
                  const promociones = tarifasValidas.filter(t => t.es_promocion);

                  return (
                    <div className="space-y-4 max-h-[220px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[#2a2a2c]">
                      
                      {promociones.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[10px] font-black text-green-400 uppercase tracking-widest block bg-green-500/10 w-fit px-2 py-0.5 rounded">⚡ Promos de Hoy</span>
                          <div className="grid grid-cols-1 gap-2">
                            {promociones.map(t => (
                              <button
                                key={t.id_tarifa}
                                onClick={() => setSelectedTarifaId(t.id_tarifa)}
                                className={`p-3 border-2 rounded-xl text-left transition-all relative overflow-hidden ${
                                  selectedTarifaId === t.id_tarifa 
                                    ? "border-green-500 bg-green-500/10" 
                                    : "border-green-500/30 bg-black/40 hover:border-green-500/60"
                                }`}
                              >
                                {selectedTarifaId === t.id_tarifa && <div className="absolute top-0 right-0 bg-green-500 text-black text-[10px] font-black px-2 py-0.5 rounded-bl-lg">SELECCIONADA</div>}
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-bold text-sm text-white flex items-center gap-1.5">
                                      {t.nombre}
                                    </div>
                                    <div className="text-xs text-green-300/80 mt-0.5 font-medium">{t.descripcion}</div>
                                    
                                    {t.productos_incluidos && t.productos_incluidos.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        {t.productos_incluidos.map((p: any) => (
                                          <span key={p.id_producto} className="text-[9px] bg-white/10 text-white px-1.5 py-0.5 rounded flex items-center gap-1">
                                            🍺 +{p.cantidad} {p.nombre}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right shrink-0 ml-2">
                                    <div className="font-extrabold text-white">
                                      Bs. {t.precio_fijo ? Number(t.precio_fijo).toFixed(2) : Number(t.precio_hora).toFixed(2)}
                                    </div>
                                    <div className="text-[10px] text-billar-gray">
                                      {t.precio_fijo ? 'fijo' : 'por hora'}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {tarifasNormales.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold text-billar-gray uppercase tracking-widest block">Tarifas Regulares</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {tarifasNormales.map(t => (
                              <button
                                key={t.id_tarifa}
                                onClick={() => setSelectedTarifaId(t.id_tarifa)}
                                className={`p-2.5 border rounded-xl text-left flex justify-between items-center transition-all ${
                                  selectedTarifaId === t.id_tarifa 
                                    ? "border-billar-primary bg-billar-primary/10 text-white" 
                                    : "border-[#2a2a2c] bg-black/20 text-billar-gray hover:text-white hover:border-[#3a3a3c]"
                                }`}
                              >
                                <div>
                                  <div className="font-bold text-sm text-white">{t.nombre}</div>
                                  <div className="text-[10px] text-billar-gray capitalize">Días: {t.tipo_dia}</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-white">Bs. {Number(t.precio_hora).toFixed(2)}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="p-6 border-t border-[#2a2a2c] bg-black/20 flex gap-3 shrink-0">
              <button onClick={() => { setIsOpeningSession(false); setSelectedMesa(null); }} className="flex-1 py-3 rounded-lg border border-[#2a2a2c] hover:bg-[#2a2a2c] text-white font-bold text-sm">Cancelar</button>
              <button onClick={handleConfirmStart} className="flex-[2] py-3 rounded-lg bg-billar-primary hover:bg-billar-primary-dark text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(220, 38, 38,0.3)]"><Play className="w-4 h-4 fill-white" /> Iniciar Mesa</button>
            </div>
          </div>
        </div>
      )}

      {/* --- PANEL DE POS --- */}
      {isPosOpen && posMesa && posSesion && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-6">
          <div className="bg-[#141416] border border-[#2a2a2c] w-full h-[95vh] md:h-full max-w-6xl rounded-2xl flex flex-col md:flex-row overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* IZQUIERDA: Cuenta y Resumen */}
            <div className="w-full md:w-1/3 h-[50vh] md:h-full border-b md:border-b-0 md:border-r border-[#2a2a2c] flex flex-col bg-[#1a1a1c]">
              <div className="p-4 sm:p-5 border-b border-[#2a2a2c] bg-[#1a1a1c] flex justify-between items-center shrink-0">
                <div>
                  <h3 className="font-black text-xl text-white flex items-center gap-2">
                    <CircleDot className="text-billar-primary w-5 h-5" />
                    Mesa {posMesa.numero}
                  </h3>
                  <span className="text-xs text-billar-gray uppercase font-bold tracking-wider">{posSesion.modalidad}</span>
                </div>
                <button onClick={() => setIsPosOpen(false)} className="p-2 hover:bg-[#2a2a2c] rounded-full text-billar-gray transition-colors"><X className="w-5 h-5" /></button>
              </div>

              {/* Items de la cuenta */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-[#2a2a2c]">
                
                {/* Item fijo de Tiempo de Juego */}
                <div className="bg-[#2a2a2c]/30 border border-billar-primary/30 p-3 rounded-xl flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-billar-primary/20 p-2 rounded-lg">
                        {posSesion.modalidad === 'partida' ? <Check className="w-5 h-5 text-billar-primary" /> : <Timer className="w-5 h-5 text-billar-primary animate-pulse" />}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">{posSesion.modalidad === 'partida' ? 'Cargo Fijo por Ficha' : 'Tiempo de Juego'}</h4>
                        <p className="text-xs text-billar-gray font-mono">{getSessionDetails(posSesion).timeString} ({getSessionDetails(posSesion).tarifaNombre})</p>
                      </div>
                    </div>
                    <div className="text-right font-black text-white">
                      Bs. {getSessionDetails(posSesion).accumulatedValue}
                    </div>
                  </div>
                  
                  {/* Extensiones de Tiempo (Solo FIJO) */}
                  {posSesion.modalidad === 'fijo' && (
                    <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-[#2a2a2c]/50">
                      <div className="flex gap-2">
                        <button onClick={() => handleAddTime(15)} className="flex-1 bg-[#1a1a1c] hover:bg-[#2a2a2c] border border-[#2a2a2c] hover:border-billar-primary/50 text-white text-xs font-bold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1"><Plus className="w-3 h-3"/> 15 min</button>
                        <button onClick={() => handleAddTime(30)} className="flex-1 bg-[#1a1a1c] hover:bg-[#2a2a2c] border border-[#2a2a2c] hover:border-billar-primary/50 text-white text-xs font-bold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1"><Plus className="w-3 h-3"/> 30 min</button>
                        <button onClick={() => handleAddTime(60)} className="flex-1 bg-[#1a1a1c] hover:bg-[#2a2a2c] border border-[#2a2a2c] hover:border-billar-primary/50 text-white text-xs font-bold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1"><Plus className="w-3 h-3"/> 1 hora</button>
                      </div>
                      <button onClick={handleConvertToAbierto} className="w-full bg-[#1a1a1c] hover:bg-billar-primary/10 border border-[#2a2a2c] hover:border-billar-primary/50 text-billar-primary text-xs font-bold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1">Cobrar solo Consumido</button>
                    </div>
                  )}
                </div>

                {/* Items de Productos */}
                {posVenta?.items.map((item) => (
                  <div key={item.id_venta_item} className="bg-black/30 border border-[#2a2a2c] p-3 rounded-xl flex items-center justify-between group">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex flex-col items-center gap-1 bg-[#1a1a1c] border border-[#2a2a2c] rounded-lg overflow-hidden shrink-0">
                        <button onClick={() => handleAddProduct(item.producto as Producto)} className="p-1 hover:bg-[#2a2a2c] text-white w-full flex justify-center"><Plus className="w-3 h-3" /></button>
                        <span className="text-xs font-bold w-7 text-center">{item.cantidad}</span>
                        <button onClick={() => handleRemoveProduct(item)} className="p-1 hover:bg-[#2a2a2c] text-white w-full flex justify-center"><Minus className="w-3 h-3" /></button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-white text-sm truncate">{item.producto?.nombre}</h4>
                        <p className="text-[10px] text-billar-gray">Bs. {Number(item.precio_unitario).toFixed(2)} c/u</p>
                      </div>
                    </div>
                    <div className="text-right font-bold text-white ml-2">
                      Bs. {Number(item.subtotal).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Totalizador */}
              <div className="p-5 border-t border-[#2a2a2c] bg-[#1a1a1c] shrink-0">
                <div className="flex justify-between mb-2 text-sm">
                  <span className="text-billar-gray">Subtotal Productos</span>
                  <span className="font-bold text-white">Bs. {(posVenta?.items.reduce((acc, i) => acc + i.subtotal, 0) || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-4 text-sm border-b border-[#2a2a2c] pb-4">
                  <span className="text-billar-gray">{posSesion.modalidad === 'partida' ? 'Costo Fijo' : 'Tiempo Calculado'}</span>
                  <span className="font-bold text-billar-primary">Bs. {getSessionDetails(posSesion).accumulatedValue}</span>
                </div>
                <div className="flex justify-between items-end mb-4">
                  <span className="text-xs text-billar-gray uppercase tracking-wider font-bold">Total a Pagar</span>
                  <span className="text-3xl font-black text-white">
                    Bs. {((posVenta?.items.reduce((acc, i) => acc + i.subtotal, 0) || 0) + Number(getSessionDetails(posSesion).accumulatedValue)).toFixed(2)}
                  </span>
                </div>
                {isMesero ? (
                  <div className="w-full py-3 border border-[#2a2a2c] bg-black/20 text-billar-gray rounded-xl text-center text-sm font-bold flex flex-col justify-center">
                    Solo Cajero puede cobrar
                    <span className="text-[10px] font-normal opacity-70">Avisa al cliente que pase a caja.</span>
                  </div>
                ) : (
                  <button onClick={openCobroModal} className="w-full py-4 bg-billar-primary hover:bg-billar-primary-dark text-white rounded-xl font-bold text-lg transition-all shadow-[0_0_20px_rgba(220, 38, 38,0.3)] flex justify-center items-center gap-2">
                    <Banknote className="w-5 h-5" /> Cobrar y Finalizar
                  </button>
                )}
              </div>
            </div>

            {/* DERECHA: Catálogo POS */}
            <div className="flex-1 min-w-0 h-[45vh] md:h-full flex flex-col bg-[#141416]">
            {/* Buscador de productos */}
            <div className="p-3 sm:p-4 border-b border-[#2a2a2c] bg-[#1a1a1c] shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-billar-gray/50" />
                <input 
                  type="text" 
                  placeholder="Buscar producto..." 
                  value={searchProductoQuery}
                  onChange={e => setSearchProductoQuery(e.target.value)}
                  className="bg-[#141416] border border-[#2a2a2c] rounded-lg py-2 pl-9 pr-3 text-sm text-white w-full focus:outline-none focus:border-billar-primary transition-colors"
                />
              </div>
            </div>

            <div className="p-3 sm:p-4 border-b border-[#2a2a2c] bg-[#1a1a1c] overflow-x-auto flex gap-2 shrink-0 scrollbar-thin scrollbar-thumb-[#2a2a2c]">
              <button onClick={() => setActiveCategory('all')} className={`shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeCategory === 'all' ? 'bg-white text-black' : 'bg-[#2a2a2c] text-billar-gray hover:text-white'}`}>Todos</button>
              {categorias.map(cat => <button key={cat.id_categoria} onClick={() => setActiveCategory(cat.id_categoria)} className={`shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeCategory === cat.id_categoria ? 'bg-white text-black' : 'bg-[#2a2a2c] text-billar-gray hover:text-white'}`}>{cat.nombre}</button>)}
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 content-start scrollbar-thin scrollbar-thumb-[#2a2a2c]">
                {filteredProducts.map(prod => (
                  <button key={prod.id_producto} onClick={() => handleAddProduct(prod)} className="bg-[#1a1a1c] border border-[#2a2a2c] hover:border-billar-primary/50 hover:shadow-[0_0_15px_rgba(220, 38, 38,0.15)] rounded-2xl p-4 flex flex-col items-center justify-between aspect-square transition-all active:scale-95 group">
                    <div className="w-16 h-16 rounded-xl bg-black/40 flex items-center justify-center mb-3 group-hover:bg-billar-primary/20 transition-colors overflow-hidden">
                      {prod.imagen_url ? (
                        <img src={prod.imagen_url} alt={prod.nombre} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                      ) : (
                        <Tag className="w-6 h-6 text-billar-gray group-hover:text-billar-primary transition-colors" />
                      )}
                    </div>
                    <div className="text-center w-full">
                      <h4 className="font-bold text-sm text-white leading-tight mb-1 line-clamp-2">{prod.nombre}</h4>
                      <p className="font-black text-billar-primary">Bs. {prod.precio_venta.toFixed(2)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Cobrar Checkout Final */}
      {isClosingSession && posSesion && posMesa && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-[#1a1a1c] border border-[#2a2a2c] w-full max-w-md rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl">
            <div className="p-6 border-b border-[#2a2a2c] text-center">
              <h3 className="font-black text-2xl text-white">Finalizar Mesa {posMesa.numero}</h3>
              <p className="text-sm text-billar-gray">Elige el método de pago para cerrar</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="bg-billar-primary/10 border border-billar-primary/30 p-6 rounded-2xl text-center space-y-2">
                <span className="text-sm text-billar-primary uppercase tracking-wider font-bold">Total a Cobrar</span>
                <div className="text-5xl font-black text-white">Bs. {((posVenta?.items.reduce((acc, i) => acc + i.subtotal, 0) || 0) + Number(getSessionDetails(posSesion).accumulatedValue)).toFixed(2)}</div>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium text-billar-gray block text-center">Método de Pago</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['efectivo', 'qr'] as const).map((metodo) => (
                    <button key={metodo} onClick={() => setMetodoPago(metodo)} className={`p-4 border rounded-xl flex flex-col items-center gap-2 transition-all ${metodoPago === metodo ? "border-billar-primary bg-billar-primary/20 text-white" : "border-[#2a2a2c] bg-black/40 text-billar-gray hover:text-white hover:bg-[#2a2a2c]"}`}>
                      <Banknote className="w-6 h-6" />
                      <span className="text-xs font-bold capitalize">{metodo}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-[#2a2a2c] bg-black/40 flex gap-3">
              <button onClick={() => setIsClosingSession(false)} className="flex-1 py-3 rounded-xl border border-[#2a2a2c] hover:bg-[#2a2a2c] text-white font-bold transition-all">Volver</button>
              <button onClick={handleConfirmClose} className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(22,163,74,0.4)]"><Check className="w-5 h-5" /> Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: GESTIÓN DE MESAS (CRUD) --- */}
      {isManagingMesas && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-[#1a1a1c] border border-[#2a2a2c] w-full max-w-3xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-[#2a2a2c] flex justify-between items-center shrink-0 bg-black/20">
              <h3 className="font-bold text-xl text-white flex items-center gap-2">
                <Settings className="w-6 h-6 text-billar-primary" /> 
                Gestión de Mesas
              </h3>
              <button onClick={() => { setIsManagingMesas(false); setIsEditingMesa(false); }} className="text-billar-gray hover:text-white"><X className="w-5 h-5"/></button>
            </div>

            <div className="p-6 border-b border-[#2a2a2c] bg-[#141416] shrink-0">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="w-full sm:w-24">
                  <label className="text-xs font-bold text-billar-gray uppercase tracking-wider block mb-1">Número</label>
                  <input type="number" value={mesaFormData.numero} onChange={e => setMesaFormData({...mesaFormData, numero: parseInt(e.target.value)||1})} className="w-full bg-black border border-[#2a2a2c] rounded-lg py-2.5 px-3 text-white focus:border-billar-primary outline-none" />
                </div>
                <div className="flex-1 w-full">
                  <label className="text-xs font-bold text-billar-gray uppercase tracking-wider block mb-1">Nombre (Opcional)</label>
                  <input type="text" placeholder="Ej: VIP Central" value={mesaFormData.nombre || ""} onChange={e => setMesaFormData({...mesaFormData, nombre: e.target.value})} className="w-full bg-black border border-[#2a2a2c] rounded-lg py-2.5 px-3 text-white focus:border-billar-primary outline-none" />
                </div>
                <div className="flex-1 w-full">
                  <label className="text-xs font-bold text-billar-gray uppercase tracking-wider block mb-1">Tipo</label>
                  <select value={mesaFormData.tipo} onChange={e => setMesaFormData({...mesaFormData, tipo: e.target.value as any})} className="w-full bg-black border border-[#2a2a2c] rounded-lg py-2.5 px-3 text-white focus:border-billar-primary outline-none [color-scheme:dark]">
                    <option value="pool">Pool</option>
                    <option value="americana">Americana</option>
                    <option value="snooker">Snooker</option>
                    <option value="carambola">Carambola</option>
                    <option value="cacho">Cacho</option>
                  </select>
                </div>
                <div className="w-full sm:w-auto">
                  <button type="button" onClick={handleSaveMesa} className="w-full sm:w-auto px-6 py-2.5 bg-billar-primary hover:bg-billar-primary-dark text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all">
                    {isEditingMesa ? <Check className="w-4 h-4"/> : <Plus className="w-4 h-4"/>}
                    {isEditingMesa ? 'Guardar' : 'Añadir'}
                  </button>
                </div>
                {isEditingMesa && (
                  <button onClick={() => { setIsEditingMesa(false); setMesaFormData({numero:1, nombre:"", tipo:'pool'}); }} className="px-4 py-2.5 border border-[#2a2a2c] hover:bg-[#2a2a2c] rounded-lg text-white font-bold transition-all">
                    Cancelar
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-0">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#1a1a1c] z-10 shadow-sm">
                  <tr className="border-b border-[#2a2a2c] text-xs font-bold text-billar-gray tracking-wider uppercase">
                    <th className="py-4 pl-6">Mesa</th>
                    <th className="py-4">Tipo</th>
                    <th className="py-4 text-center">Estado</th>
                    <th className="py-4 pr-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {todasMesas.map(m => (
                    <tr key={m.id_mesa} className={`border-b border-[#2a2a2c]/40 hover:bg-white/[0.02] transition-colors ${!m.activo ? 'opacity-50' : ''}`}>
                      <td className="py-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black ${m.activo ? 'bg-white text-black' : 'bg-[#2a2a2c] text-white'}`}>
                            {m.numero}
                          </div>
                          <span className="font-bold text-white text-sm">{m.nombre || `Mesa ${m.numero}`}</span>
                        </div>
                      </td>
                      <td className="py-4 text-sm text-billar-gray capitalize">{m.tipo}</td>
                      <td className="py-4 text-center">
                        <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full border ${m.activo ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                          {m.activo ? 'Visible' : 'Oculta/Suspendida'}
                        </span>
                      </td>
                      <td className="py-4 pr-6">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => { setMesaFormData(m); setIsEditingMesa(true); }}
                            className="p-2 bg-[#2a2a2c] hover:bg-white/20 rounded-lg text-white transition-all" title="Editar Mesa"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleToggleEstadoMesa(m)}
                            className={`p-2 rounded-lg transition-all ${m.activo ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/40' : 'bg-green-500/20 text-green-400 hover:bg-green-500/40'}`}
                            title={m.activo ? "Suspender Mesa" : "Activar Mesa"}
                          >
                            {m.activo ? <Archive className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
