import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  Plane,
  Search,
  Sparkles,
} from 'lucide-react';
import escapeData from '../data/spontaneous-escapes.json';
import {
  airportCode,
  destinationsFromOrigin,
  formatMiles,
  formatTravelDate,
  searchItineraries,
} from './lib/search.js';

const offers = escapeData.offers;
const travelWindow = escapeData.promotion.travel_window;
const bookingWindow = escapeData.promotion.booking_window;
function offsetDate(value, days) {
  const result = new Date(`${value}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

const defaultOrigin = offers.some((offer) => offer.origin === 'Singapore')
  ? 'Singapore'
  : offers[0].origin;
const defaultDestinations = destinationsFromOrigin(offers, defaultOrigin);
const defaultDestination = defaultDestinations.includes('Bangkok')
  ? 'Bangkok'
  : defaultDestinations[0];
const defaultDeparture = offsetDate(travelWindow.start, 6) <= travelWindow.end
  ? offsetDate(travelWindow.start, 6)
  : travelWindow.start;
const defaultReturn = offsetDate(defaultDeparture, 5) <= travelWindow.end
  ? offsetDate(defaultDeparture, 5)
  : travelWindow.end;
const travelMonth = new Intl.DateTimeFormat('en-SG', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
}).format(new Date(`${travelWindow.start}T00:00:00Z`));

const DEFAULT_SEARCH = {
  tripType: 'round-trip',
  origin: defaultOrigin,
  destination: defaultDestination,
  departureDate: defaultDeparture,
  returnDate: defaultReturn,
  cabin: 'Any',
  airline: 'Any',
  maxMiles: null,
};

function AirlineMark({ airline, compact = false }) {
  const isScoot = airline === 'Scoot';
  return (
    <span className={`airline-mark ${isScoot ? 'scoot' : 'singapore'} ${compact ? 'compact' : ''}`}>
      <span className="airline-code">{isScoot ? 'TR' : 'SQ'}</span>
      {!compact && <span>{airline}</span>}
    </span>
  );
}

function LocationValue({ place }) {
  return (
    <span className="location-value">
      <strong>{airportCode(place, offers)}</strong>
      <span>{place}</span>
    </span>
  );
}

function ReactSelect({
  label,
  icon: Icon,
  value,
  options,
  onChange,
  renderValue,
  renderOption,
  className = '',
  compact = false,
  ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listboxId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  return (
    <div
      className={`search-field react-select ${compact ? 'compact' : ''} ${open ? 'is-open' : ''} ${className}`}
      ref={rootRef}
    >
      {label && (
        <span className="field-label">
          {Icon && <Icon size={14} aria-hidden="true" />}
          {label}
        </span>
      )}
      <button
        type="button"
        className="react-select-trigger"
        aria-label={ariaLabel || label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {selected
          ? (renderValue ? renderValue(selected) : <span className="filter-value">{selected.label}</span>)
          : <span className="filter-value">No options</span>}
      </button>
      <ChevronDown className="select-chevron" size={16} aria-hidden="true" />
      {open && (
        <div className="react-select-menu" id={listboxId} role="listbox" aria-label={ariaLabel || label}>
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                className={isSelected ? 'selected' : ''}
                key={String(option.value ?? 'any')}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{renderOption ? renderOption(option) : option.label}</span>
                {isSelected && <Check size={15} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TripLeg({ leg, index, totalLegs }) {
  const { offer, date } = leg;
  const originCode = offer.origin_code || airportCode(offer.origin, offers);
  const destinationCode = offer.destination_code || airportCode(offer.destination, offers);
  return (
    <div className="trip-leg">
      <div className="leg-date">
        <span>{totalLegs === 1 ? 'Departure' : index === 0 ? 'Outbound' : 'Return'}</span>
        <strong>{formatTravelDate(date)}</strong>
      </div>
      <div className="route-line" aria-label={`${offer.origin} to ${offer.destination}`}>
        <div>
          <strong>{originCode}</strong>
          <span>{offer.origin}</span>
        </div>
        <span className="route-rule">
          <Plane size={17} aria-hidden="true" />
        </span>
        <div className="route-arrival">
          <strong>{destinationCode}</strong>
          <span>{offer.destination}</span>
        </div>
      </div>
      <div className="leg-meta">
        <AirlineMark airline={offer.airline} compact />
        <span>{offer.cabin_class}</span>
        <span>{offer.flight_numbers.join(', ')}</span>
        <span>{formatMiles(offer.miles_required)} miles</span>
      </div>
    </div>
  );
}

function ResultCard({ itinerary, rank }) {
  return (
    <article className="result-card">
      <div className="result-rank">{String(rank).padStart(2, '0')}</div>
      <div className="result-main">
        <div className="result-topline">
          <div className="result-airlines">
            {itinerary.airlines.map((airline) => (
              <AirlineMark key={airline} airline={airline} />
            ))}
          </div>
          <span className="availability-pill"><Check size={13} /> Dates eligible</span>
        </div>
        <div className={`legs ${itinerary.legs.length > 1 ? 'return-trip' : ''}`}>
          {itinerary.legs.map((leg, index) => (
            <TripLeg key={`${leg.offer.id}-${leg.date}`} leg={leg} index={index} totalLegs={itinerary.legs.length} />
          ))}
        </div>
      </div>
      <div className="result-price">
        <span>From</span>
        <strong>{formatMiles(itinerary.totalMiles)}</strong>
        <span>KrisFlyer miles</span>
        <small>per traveller · {itinerary.cabinClass}</small>
      </div>
    </article>
  );
}

function App() {
  const allOrigins = useMemo(() => [...new Set(offers.map((offer) => offer.origin))].sort(), []);
  const [draft, setDraft] = useState(DEFAULT_SEARCH);
  const [criteria, setCriteria] = useState(DEFAULT_SEARCH);
  const [sortBy, setSortBy] = useState('miles');
  const [showAll, setShowAll] = useState(false);
  const [formError, setFormError] = useState('');

  const destinations = useMemo(
    () => destinationsFromOrigin(offers, draft.origin),
    [draft.origin],
  );
  const destinationOptions = draft.origin === 'Singapore'
    ? ['Anywhere', ...destinations]
    : destinations;

  const results = useMemo(() => {
    const found = searchItineraries(offers, criteria);
    if (sortBy === 'airline') {
      return [...found].sort((a, b) => a.airlines.join().localeCompare(b.airlines.join()) || a.totalMiles - b.totalMiles);
    }
    if (sortBy === 'cabin') {
      return [...found].sort((a, b) => a.cabinClass.localeCompare(b.cabinClass) || a.totalMiles - b.totalMiles);
    }
    return found;
  }, [criteria, sortBy]);

  const visibleResults = showAll ? results : results.slice(0, 12);

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleOriginChange(origin) {
    const nextDestinations = destinationsFromOrigin(offers, origin);
    setDraft((current) => ({
      ...current,
      origin,
      destination: nextDestinations.includes(current.destination)
        ? current.destination
        : nextDestinations[0] ?? '',
    }));
  }

  function swapRoute() {
    setDraft((current) => {
      const reverseDestinations = destinationsFromOrigin(offers, current.destination);
      if (!reverseDestinations.length) return current;
      return {
        ...current,
        origin: current.destination,
        destination: reverseDestinations.includes(current.origin)
          ? current.origin
          : reverseDestinations[0],
      };
    });
  }

  function submitSearch(event) {
    event.preventDefault();
    if (!draft.origin || !draft.destination) {
      setFormError('Choose both an origin and destination.');
      return;
    }
    if (!draft.departureDate) {
      setFormError('Choose a departure date.');
      return;
    }
    if (draft.tripType === 'round-trip' && (!draft.returnDate || draft.returnDate < draft.departureDate)) {
      setFormError('Choose a return date after your departure.');
      return;
    }
    setFormError('');
    setShowAll(false);
    setCriteria(draft);
    requestAnimationFrame(() => document.getElementById('search-results')?.scrollIntoView({ behavior: 'smooth' }));
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="back-link" href="../">
          <ArrowLeft size={16} /> Perception
        </a>
        <a className="wordmark" href="./" aria-label="Escape Miles home">
          <span className="wordmark-icon"><Plane size={18} /></span>
          <span>Escape<span>Miles</span></span>
        </a>
        <div className="header-meta">
          <span>Updated {formatTravelDate(escapeData.generated_at.slice(0, 10), true)}</span>
          <span className="live-dot">Live offers</span>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="promo-label"><Sparkles size={14} /> KrisFlyer Spontaneous Escapes</div>
            <h1>{travelMonth}</h1>
            <p className="hero-details">
              <span>Travel {formatTravelDate(travelWindow.start)}–{formatTravelDate(travelWindow.end, true)}</span>
              <span>Book by {formatTravelDate(bookingWindow.end, true)}</span>
              <span className="hero-blackout"><Check size={13} /> Blackout dates automatically excluded</span>
            </p>
          </div>
        </section>

        <section className="search-wrap" aria-label="Search award flights">
          <form className="search-panel" onSubmit={submitSearch}>
            <div className="trip-toggle" aria-label="Trip type">
              <button
                type="button"
                className={draft.tripType === 'round-trip' ? 'active' : ''}
                onClick={() => updateDraft('tripType', 'round-trip')}
              >
                Round trip
              </button>
              <button
                type="button"
                className={draft.tripType === 'one-way' ? 'active' : ''}
                onClick={() => updateDraft('tripType', 'one-way')}
              >
                One way
              </button>
            </div>

            <div className="search-grid route-grid">
              <ReactSelect
                label="From"
                icon={Plane}
                className="location-field"
                ariaLabel="Origin"
                value={draft.origin}
                onChange={handleOriginChange}
                options={allOrigins.map((place) => ({ value: place, label: place }))}
                renderValue={(option) => <LocationValue place={option.value} />}
                renderOption={(option) => (
                  <span className="location-option"><strong>{airportCode(option.value, offers)}</strong><span>{option.label}</span></span>
                )}
              />
              <button className="swap-button" type="button" onClick={swapRoute} aria-label="Swap origin and destination">
                <ArrowRightLeft size={17} />
              </button>
              <ReactSelect
                label="To"
                icon={Plane}
                className="location-field destination-field"
                ariaLabel="Destination"
                value={draft.destination}
                onChange={(value) => updateDraft('destination', value)}
                options={destinationOptions.map((place) => ({ value: place, label: place }))}
                renderValue={(option) => <LocationValue place={option.value} />}
                renderOption={(option) => (
                  <span className="location-option"><strong>{airportCode(option.value, offers)}</strong><span>{option.label}</span></span>
                )}
              />
              <label className="search-field date-field">
                <span className="field-label"><CalendarDays size={14} /> Depart</span>
                <input
                  type="date"
                  min={travelWindow.start}
                  max={travelWindow.end}
                  value={draft.departureDate}
                  onChange={(event) => updateDraft('departureDate', event.target.value)}
                />
              </label>
              <label className={`search-field date-field ${draft.tripType === 'one-way' ? 'disabled' : ''}`}>
                <span className="field-label"><CalendarDays size={14} /> Return</span>
                <input
                  type="date"
                  min={draft.departureDate || travelWindow.start}
                  max={travelWindow.end}
                  value={draft.returnDate}
                  disabled={draft.tripType === 'one-way'}
                  onChange={(event) => updateDraft('returnDate', event.target.value)}
                />
              </label>
            </div>

            <div className="search-grid filter-grid">
              <ReactSelect
                label="Cabin class"
                icon={Sparkles}
                value={draft.cabin}
                onChange={(value) => updateDraft('cabin', value)}
                options={[
                  { value: 'Any', label: 'Any cabin' },
                  ...escapeData.summary.cabin_classes.map((cabin) => ({ value: cabin, label: cabin })),
                ]}
              />
              <ReactSelect
                label="Airline"
                icon={Plane}
                value={draft.airline}
                onChange={(value) => updateDraft('airline', value)}
                options={[
                  { value: 'Any', label: 'All airlines' },
                  ...escapeData.summary.airlines.map((airline) => ({ value: airline, label: airline })),
                ]}
              />
              <ReactSelect
                label="Miles budget"
                icon={Sparkles}
                value={draft.maxMiles}
                onChange={(value) => updateDraft('maxMiles', value)}
                options={[
                  { value: null, label: 'No limit' },
                  { value: 10000, label: 'Up to 10,000' },
                  { value: 20000, label: 'Up to 20,000' },
                  { value: 40000, label: 'Up to 40,000' },
                  { value: 80000, label: 'Up to 80,000' },
                  { value: 120000, label: 'Up to 120,000' },
                ]}
              />
              <button className="search-button" type="submit">
                <Search size={19} /> Search escapes
              </button>
            </div>
            {formError && <p className="form-error"><CircleAlert size={15} /> {formError}</p>}
          </form>
        </section>

        <section className="results-section" id="search-results">
          <div className="results-heading">
            <div>
              <span className="section-eyebrow">Available escapes</span>
              <h2>{airportCode(criteria.origin, offers)} <ArrowRight size={25} /> {airportCode(criteria.destination, offers)}</h2>
              <p>
                {criteria.tripType === 'round-trip' ? 'Round trip' : 'One way'} · {formatTravelDate(criteria.departureDate, true)}
                {criteria.tripType === 'round-trip' && ` – ${formatTravelDate(criteria.returnDate, true)}`}
              </p>
            </div>
            <div className="results-actions">
              <span><strong>{results.length}</strong> {results.length === 1 ? 'option' : 'options'}</span>
              <div className="sort-control">
                <span>Sort by</span>
                <ReactSelect
                  compact
                  ariaLabel="Sort results"
                  value={sortBy}
                  onChange={setSortBy}
                  options={[
                    { value: 'miles', label: 'Lowest miles' },
                    { value: 'airline', label: 'Airline' },
                    { value: 'cabin', label: 'Cabin class' },
                  ]}
                />
              </div>
            </div>
          </div>

          {results.length > 0 ? (
            <div className="results-list">
              {visibleResults.map((itinerary, index) => (
                <ResultCard key={itinerary.id} itinerary={itinerary} rank={index + 1} />
              ))}
              {!showAll && results.length > visibleResults.length && (
                <button className="show-more" onClick={() => setShowAll(true)}>
                  Show all {results.length} options <ArrowRight size={16} />
                </button>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <span><Plane size={28} /></span>
              <h3>No eligible escapes found</h3>
              <p>Try another travel date, cabin, airline, or a higher miles budget.</p>
              <button onClick={() => {
                const reset = { ...DEFAULT_SEARCH, origin: criteria.origin, destination: criteria.destination };
                setDraft(reset);
                setCriteria(reset);
              }}>Reset filters</button>
            </div>
          )}
        </section>

        <section className="details-strip">
          <div>
            <span className="detail-number">01</span>
            <h3>Prices in miles</h3>
            <p>Every price is the promotional mileage per traveller. Taxes and fees are separate.</p>
          </div>
          <div>
            <span className="detail-number">02</span>
            <h3>Dates checked for you</h3>
            <p>Published blackout dates are applied before an itinerary appears in your results.</p>
          </div>
          <div>
            <span className="detail-number">03</span>
            <h3>Book with the airline</h3>
            <p>Availability can change. Complete your redemption on Singapore Airlines or Scoot.</p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wordmark footer-wordmark">
          <span className="wordmark-icon"><Plane size={16} /></span>
          <span>Escape<span>Miles</span></span>
        </div>
        <p>Independent discovery tool. Not affiliated with Singapore Airlines or Scoot.</p>
        <p>Data refreshed {formatTravelDate(escapeData.generated_at.slice(0, 10), true)}</p>
      </footer>
    </div>
  );
}

export default App;
