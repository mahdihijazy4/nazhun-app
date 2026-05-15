import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { UserProfile } from '../types';
import { User as UserIcon, MapPin, MessageCircle, Home } from 'lucide-react';
import { motion } from 'motion/react';

// Fix Leaflet marker icons
import 'leaflet/dist/leaflet.css';

// Custom icons
const createCustomIcon = (photoURL: string | undefined, isSameVillage: boolean, villagerText: string) => {
  return L.divIcon({
    html: `
      <div class="relative p-1 rounded-full bg-zinc-900 border-2 ${isSameVillage ? 'border-[#1DB954] scale-110 shadow-[0_0_15px_rgba(29,185,84,0.5)]' : 'border-theme-white/20 shadow-xl'} transition-all hover:scale-125 cursor-pointer flex items-center justify-center">
        <div class="w-10 h-10 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center shadow-inner">
          ${photoURL 
            ? `<img src="${photoURL}" class="w-full h-full object-cover" referrerPolicy="no-referrer" />`
            : `<div class="text-zinc-600"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>`
          }
        </div>
        ${isSameVillage ? `
        <div class="absolute -top-2 -right-2 bg-[#1DB954] text-theme-black text-[10px] font-black px-2 py-0.5 rounded-full border border-black whitespace-nowrap shadow-lg">
          ${villagerText}
        </div>` : ''}
      </div>
    `,
    className: 'bg-transparent border-none',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
};

interface MapDiscoveryProps {
  users: UserProfile[];
  profile: UserProfile | null;
  onUserClick: (userId: string) => void;
  onStartChat: (userId: string) => void;
  t: any;
  locations?: { name: string; lat: number; lng: number }[];
}

// Helper to center map if profile changes
const MapEffect = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  React.useEffect(() => {
    map.flyTo(center, 13, { duration: 1.5 });
  }, [center, map]);
  return null;
};

export const MapDiscovery: React.FC<MapDiscoveryProps> = ({ users, profile, onUserClick, onStartChat, t, locations = [] }) => {
  const profileLocation = locations.find(l => l.name === profile?.currentLocation);
  const center: [number, number] = profile?.coords 
    ? [profile.coords.lat, profile.coords.lng] 
    : profileLocation 
      ? [profileLocation.lat, profileLocation.lng]
      : [33.8938, 35.5018]; // Beirut

  return (
    <div className="h-full w-full relative rounded-[40px] overflow-hidden border border-theme-white/10 shadow-2xl bg-zinc-900">
      <style>{`
        .leaflet-container {
          background: #09090b !important;
          width: 100%;
          height: 100%;
        }
        .leaflet-tile {
          filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
        }
        .leaflet-popup-content-wrapper {
          background: #18181b !important;
          color: white !important;
          border-radius: 20px !important;
          padding: 0 !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
        }
        .leaflet-popup-tip {
          background: #18181b !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
          min-width: 200px !important;
        }
        .marker-cluster {
          background-clip: padding-box;
          border-radius: 50%;
        }
        .marker-cluster div {
          width: 40px;
          height: 40px;
          margin-left: 5px;
          margin-top: 5px;
          text-align: center;
          border-radius: 50%;
          font-family: inherit;
        }
        .marker-cluster span {
          line-height: 40px;
        }
        .marker-cluster-small, .marker-cluster-medium, .marker-cluster-large {
          background-color: rgba(29, 185, 84, 0.3) !important;
          border: 2px solid rgba(29, 185, 84, 0.5);
          backdrop-filter: blur(4px);
          box-shadow: 0 0 20px rgba(29, 185, 84, 0.2);
        }
        .marker-cluster-small div, .marker-cluster-medium div, .marker-cluster-large div {
          background-color: #1DB954 !important;
          color: black !important;
          font-weight: 900 !important;
          font-size: 16px !important;
          border: 2px solid #000;
          box-shadow: inset 0 2px 4px rgba(255,255,255,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
      
      <MapContainer 
        center={center} 
        zoom={12} 
        scrollWheelZoom={true}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapEffect center={center} />

        <MarkerClusterGroup
          chunkedLoading
          showCoverageOnHover={false}
          maxClusterRadius={50}
        >
          {users.map(user => {
            const userLocation = locations.find(l => l.name === user.currentLocation);
            const coords = user.coords || (userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null);
            
            if (!coords) return null;

            // Add a very small random jitter to coordinates to prevent perfect overlap 
            // if multiple users are in the same village
            const jitter = 0.0001;
            const seed = user.uid.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const lat = coords.lat + (Math.sin(seed) * jitter);
            const lng = coords.lng + (Math.cos(seed) * jitter);

            return (
              <Marker 
                key={user.uid} 
                position={[lat, lng]}
                icon={createCustomIcon(user.photoURL, user.hometownId === profile?.hometownId, t.villagers)}
              >
                <Popup>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0">
                        {user.photoURL ? (
                          <img src={user.photoURL} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-zinc-900 border border-theme-white/5"><UserIcon size={24} className="text-zinc-600" /></div>
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-theme-white text-base leading-tight">{user.name}</h4>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1 text-zinc-500 text-[9px] font-black uppercase tracking-widest">
                            <Home size={10} />
                            {user.hometown}
                          </div>
                          <div className="flex items-center gap-1 text-amber-500 text-[9px] font-black uppercase tracking-widest">
                            <MapPin size={10} />
                            {user.currentLocation}
                          </div>
                        </div>
                      </div>
                    </div>
                  
                  {user.bio && (
                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                      {user.bio}
                    </p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button 
                      onClick={() => onUserClick(user.uid)}
                      className="flex-1 bg-theme-white text-theme-black text-[10px] font-black uppercase tracking-widest py-2.5 rounded-xl transition-transform active:scale-95"
                    >
                      {t.profile}
                    </button>
                    <button 
                      onClick={() => onStartChat(user.uid)}
                      className="bg-amber-500 text-theme-black p-2.5 rounded-xl transition-transform active:scale-95 shadow-lg shadow-amber-500/20"
                    >
                      <MessageCircle size={16} />
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
};
