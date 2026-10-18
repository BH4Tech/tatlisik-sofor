'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LogOut, Package, MapPin, Clock, Navigation, CheckCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  const [driverName, setDriverName] = useState('');
  const [driverId, setDriverId] = useState<string | null>(null);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  
  // Hangi kartlarin genisletildigini tutan state
  const [expandedCards, setExpandedCards] = useState<string[]>([]);

  useEffect(() => {
    const id = localStorage.getItem('driver_id');
    const name = localStorage.getItem('driver_name');

    if (!id) {
      router.replace('/');
      return;
    }

    setDriverId(id);
    setDriverName(name || '');
    fetchShipments(id);
    startTracking(id);

    return () => {
      stopTracking();
    };
  }, [router]);

  // Supabase Realtime Subscription
  useEffect(() => {
    if (!driverId) return;

    const channel = supabase
      .channel('driver_shipments_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shipments',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          console.log('Sevkiyat verisi guncellendi!', payload);
          fetchShipments(driverId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId]);

  const fetchShipments = async (dId: string) => {
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select(`
          id,
          target_branch_name,
          driver_status,
          status,
          shipment_items(
            shipped_quantity,
            products(name, unit)
          )
        `)
        .eq('driver_id', dId)
        .neq('status', 'cancelled')
        .neq('status', 'completed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setShipments(data || []);
    } catch (err) {
      console.error('Sevkiyatlar alinirken hata:', err);
    } finally {
      setLoading(false);
    }
  };

  const startTracking = (dId: string) => {
    if (watchIdRef.current !== null) return;
    
    if (!navigator.geolocation) {
      console.warn("Konum servisi desteklenmiyor");
      return;
    }

    console.log("GPS takibi basladi...");
    const id = navigator.geolocation.watchPosition(
      async (position) => {
        await supabase.from('driver_locations').upsert({
          driver_id: dId,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          updated_at: new Date().toISOString()
        });
      },
      (error) => {
        console.error('Konum alinamadi:', error);
        setLocationError(error.message);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
    watchIdRef.current = id;
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      console.log("GPS takibi durduruldu.");
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const handleAction = async (shipmentId: string, newDriverStatus: string) => {
    setActionLoading(shipmentId);
    try {
      const updates: any = { driver_status: newDriverStatus };
      if (newDriverStatus === 'in_transit') updates.picked_up_at = new Date().toISOString();
      if (newDriverStatus === 'delivered_to_branch') updates.driver_delivered_at = new Date().toISOString();

      const { error } = await supabase
        .from('shipments')
        .update(updates)
        .eq('id', shipmentId);

      if (error) throw error;
      
      if (driverId) await fetchShipments(driverId);
    } catch (err) {
      console.error('Statu guncellenirken hata:', err);
      alert('Islem basarisiz oldu, lutfen tekrar deneyin.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = () => {
    stopTracking();
    localStorage.removeItem('driver_id');
    localStorage.removeItem('driver_name');
    router.replace('/');
  };

  const toggleCard = (shipmentId: string) => {
    setExpandedCards(prev => 
      prev.includes(shipmentId) 
        ? prev.filter(id => id !== shipmentId) 
        : [...prev, shipmentId]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-rose-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <header className="bg-rose-500 shadow-md sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center">
              Tatlışık Teslimat
              {locationError && <span className="ml-2 text-xs bg-rose-700 px-2 py-0.5 rounded text-white" title="Konum Erisimi Yok">GPS ⚠️</span>}
            </h1>
            <p className="text-rose-100 text-sm">Merhaba, {driverName}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 bg-rose-600 rounded-full text-white hover:bg-rose-700 transition"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {shipments.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Aktif Sevkiyat Yok</h3>
            <p className="text-gray-500 mt-2">Şu an üzerinize atanmış bekleyen veya yolda olan bir sevkiyat bulunmuyor.</p>
          </div>
        ) : (
          shipments.map(shipment => {
            const isPending = shipment.driver_status === 'pending';
            const isTransit = shipment.driver_status === 'in_transit';
            const isDelivered = shipment.driver_status === 'delivered_to_branch';
            
            const isExpanded = expandedCards.includes(shipment.id);
            const totalItems = shipment.shipment_items.length;
            const visibleItems = isExpanded ? shipment.shipment_items : shipment.shipment_items.slice(0, 5);
            const hiddenCount = totalItems - 5;

            return (
              <div key={shipment.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                {/* Card Header */}
                <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center">
                      <MapPin className="w-5 h-5 text-rose-500 mr-2" />
                      {shipment.target_branch_name}
                    </h2>
                  </div>
                  
                  {/* Status Badge */}
                  {isPending && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      <Clock className="w-3 h-3 mr-1" /> Bekliyor
                    </span>
                  )}
                  {isTransit && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700">
                      <Navigation className="w-3 h-3 mr-1" /> Yolda
                    </span>
                  )}
                  {isDelivered && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" /> Teslim Edildi
                    </span>
                  )}
                </div>

                {/* Items List */}
                <div 
                  className="p-4 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleCard(shipment.id)}
                >
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Teslim Edilecek Ürünler</h3>
                    {hiddenCount > 0 && (
                      <span className="text-rose-500">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </span>
                    )}
                  </div>
                  <ul className="space-y-2">
                    {visibleItems.map((item: any, idx: number) => (
                      <li key={idx} className="flex justify-between items-center text-sm">
                        <span className="text-gray-700 font-medium">{item.products?.name}</span>
                        <span className="text-gray-900 font-bold bg-gray-100 px-2 py-0.5 rounded">
                          {item.shipped_quantity} {item.products?.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                  
                  {hiddenCount > 0 && !isExpanded && (
                    <div className="mt-3 text-center text-sm font-medium text-rose-500 bg-rose-50 py-1.5 rounded-lg">
                      +{hiddenCount} diğer ürün... (Tümü için tıkla)
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="p-4 flex gap-3">
                  {!isDelivered ? (
                    <>
                      <button
                        disabled={!isPending || actionLoading === shipment.id}
                        onClick={() => handleAction(shipment.id, 'in_transit')}
                        className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex justify-center items-center transition-colors ${
                          isPending 
                            ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm' 
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {actionLoading === shipment.id && isPending ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          'Ürünleri Aldım'
                        )}
                      </button>

                      <button
                        disabled={!isTransit || actionLoading === shipment.id}
                        onClick={() => handleAction(shipment.id, 'delivered_to_branch')}
                        className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex justify-center items-center transition-colors ${
                          isTransit 
                            ? 'bg-green-600 text-white hover:bg-green-700 shadow-sm' 
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {actionLoading === shipment.id && isTransit ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          'Teslim Ettim'
                        )}
                      </button>
                    </>
                  ) : (
                    <div className="w-full flex items-center justify-center py-3 text-green-700 bg-green-50 rounded-xl font-medium">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Şube onayı bekleniyor
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
