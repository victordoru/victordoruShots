import React from "react";
import dayjs from "dayjs";
import { Link } from "react-router-dom";
import { MapPinIcon } from "@heroicons/react/24/outline";

const EventCardProfile = ({ event }) => {
  //console.log("eventoOOOOOOOOOOOOO", event);
  return (
    <div className="w-full">
      <div className="rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200 bg-white border border-gray-200 flex flex-col">
        {/* Event cover image - moderate height */}
        <div className="relative h-36 w-full overflow-hidden">
          {event.cover ? (
            <img 
              src={event.cover} 
              alt={event.name} 
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <span className="text-gray-400">No image</span>
            </div>
          )}
          
          {/* Date overlay */}
          {event.startDate && (
            <div className="absolute top-2 right-2 bg-coral text-white py-1 px-2 rounded text-xs font-medium shadow-sm">
              {dayjs(event.startDate).format('DD MMM')}
            </div>
          )}
        </div>
        
        {/* Event details - clean layout */}
        <div className="p-3">
          {/* Event name and location */}
          <h3 className="font-semibold text-base text-gray-900 leading-tight mb-1 truncate">{event.name}</h3>
          
          {/* Location if available */}
          {event.location && (
            <div className="flex items-center text-gray-600 text-xs mb-3">
              <MapPinIcon className="h-3 w-3 mr-1 flex-shrink-0 text-coral" />
              <span className="truncate">{event.location}</span>
            </div>
          )}
          
          {/* Action buttons - simplified */}
          <div className="flex gap-2 mt-2">
            <Link 
              to={`/events/${event.eventId || event._id}`}
              className="flex-1 text-center py-1.5 px-2 bg-white border border-coral text-coral rounded hover:bg-coral/5 transition-colors text-xs font-medium"
            >
              Ver evento
            </Link>
            
            <Link 
              to={`/mistickets/${event._id}`}
              className="flex-1 text-center py-1.5 px-2 bg-coral text-white rounded hover:bg-coral/90 transition-colors text-xs font-medium"
            >
              Ver tickets
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventCardProfile;
