// src/components/EventCard.jsx
import dayjs from "dayjs";
import PropTypes from 'prop-types';
import { Link } from "react-router-dom";
import { MapPinIcon, CalendarDaysIcon } from "@heroicons/react/24/solid";

const EventCard = ({ event, onMouseEnter, onMouseLeave, isHovered }) => {
  if (!event) return null;

  const hoverShadow = isHovered ? "shadow-[0_0_0_2px_#FF7F50,0_6px_20px_rgba(255,127,80,0.5)]" : "shadow-md hover:shadow-lg";

  return (
    <div 
      className={`w-full min-h-[280px] sm:min-h-[300px] h-full flex flex-col bg-white rounded-lg overflow-hidden transition-all duration-200 ease-in-out transform hover:-translate-y-0.5 ${hoverShadow}`}
      onMouseEnter={() => onMouseEnter(event._id)}
      onMouseLeave={onMouseLeave}
      style={{ willChange: 'transform, box-shadow' }} 
    >
      <Link to={`/events/${event._id}`} className="flex flex-col h-full">
        <div className="relative w-full h-40 sm:h-48 bg-gray-100">
          <img
            src={event.cover || "https://dummyimage.com/600x350/f0f0f0/aaa.png&text=Evento"}
            alt={`Cover for ${event.name}`}
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute top-1.5 right-1.5 bg-coral text-white p-1.5 rounded shadow-md flex flex-col items-center justify-center leading-tight min-w-[40px]">
            <span className="font-bold text-md">{dayjs(event.startDate).format('DD')}</span>
            <span className="text-[10px] uppercase tracking-wide">{dayjs(event.startDate).format('MMM')}</span>
          </div>
        </div>
        <div className="p-3 flex flex-col flex-grow">
          <h2 className="text-md font-semibold text-[#333333] truncate mb-1" title={event.name}>{event.name}</h2>
          
          <div className="flex items-center text-xs text-gray-700 mb-0.5">
            <MapPinIcon className="w-3.5 h-3.5 text-coral mr-1 flex-shrink-0" />
            <span className="truncate" title={event.location}>{event.location || "Ubicación no especificada"}</span>
          </div>

          <div className="flex items-center text-xs text-gray-500 mb-1.5">
            <CalendarDaysIcon className="w-3.5 h-3.5 text-coral mr-1 flex-shrink-0" />
            <span>{dayjs(event.startDate).format('DD MMM YYYY, HH:mm')}</span>
          </div>
          
          <div className="flex-grow"></div> 

          {event.category && (
            <span className="mt-1 text-[10px] text-coral bg-coral/10 self-start inline-block px-1.5 py-0.5 rounded-full font-medium">
              {event.category}
            </span>
          )}
        </div>
      </Link>
    </div>
  );
};

EventCard.propTypes = {
  event: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    slug: PropTypes.string,
    cover: PropTypes.string,
    name: PropTypes.string.isRequired,
    location: PropTypes.string,
    startDate: PropTypes.string.isRequired,
    category: PropTypes.string,
  }).isRequired,
  onMouseEnter: PropTypes.func.isRequired,
  onMouseLeave: PropTypes.func.isRequired,
  isHovered: PropTypes.bool.isRequired,
};

export default EventCard;