const FALLBACK_CODES = {
  Adelaide: 'ADL',
  Ahmedabad: 'AMD',
  Amsterdam: 'AMS',
  Anywhere: 'ANY',
  Bangkok: 'BKK',
  Beijing: 'PEK',
  'Beijing Daxing': 'PKX',
  Brisbane: 'BNE',
  Brunei: 'BWN',
  Brussels: 'BRU',
  Cairns: 'CNS',
  Chengdu: 'TFU',
  Chennai: 'MAA',
  Chongqing: 'CKG',
  Colombo: 'CMB',
  Copenhagen: 'CPH',
  'Da Nang': 'DAD',
  Darwin: 'DRW',
  Delhi: 'DEL',
  Denpasar: 'DPS',
  Dhaka: 'DAC',
  Frankfurt: 'FRA',
  Hanoi: 'HAN',
  Hangzhou: 'HGH',
  'Ho Chi Minh City': 'SGN',
  'Hong Kong': 'HKG',
  Jakarta: 'CGK',
  Johannesburg: 'JNB',
  'Kuala Lumpur': 'KUL',
  'London (LGW)': 'LGW',
  'London (LHR)': 'LHR',
  Male: 'MLE',
  Manchester: 'MAN',
  Manila: 'MNL',
  Medan: 'KNO',
  Melbourne: 'MEL',
  Milan: 'MXP',
  Mumbai: 'BOM',
  'New York': 'JFK',
  Paris: 'CDG',
  Penang: 'PEN',
  'Phnom Penh': 'PNH',
  Phuket: 'HKT',
  Seattle: 'SEA',
  Shanghai: 'PVG',
  Shenzhen: 'SZX',
  'Siem Reap': 'SAI',
  Singapore: 'SIN',
  Surabaya: 'SUB',
  Sydney: 'SYD',
  Taipei: 'TPE',
  Xiamen: 'XMN',
};

export function airportCode(place, offers = []) {
  const offer = offers.find(
    (item) => item.origin === place && item.origin_code,
  ) ?? offers.find((item) => item.destination === place && item.destination_code);
  return offer?.origin === place ? offer.origin_code : offer?.destination_code ?? FALLBACK_CODES[place] ?? '—';
}

export function placesFromOffers(offers) {
  return [...new Set(offers.flatMap((offer) => [offer.origin, offer.destination]))].sort();
}

export function destinationsFromOrigin(offers, origin) {
  return [...new Set(offers.filter((offer) => offer.origin === origin).map((offer) => offer.destination))].sort();
}

export function isOfferAvailable(offer, travelDate) {
  return Boolean(travelDate) && !offer.blackout_dates.includes(travelDate);
}

function matchesFilters(offer, criteria) {
  return (
    (criteria.cabin === 'Any' || offer.cabin_class === criteria.cabin) &&
    (criteria.airline === 'Any' || offer.airline === criteria.airline)
  );
}

function itineraryFromLegs(legs) {
  const totalMiles = legs.reduce((sum, leg) => sum + leg.offer.miles_required, 0);
  const cabins = [...new Set(legs.map((leg) => leg.offer.cabin_class))];
  return {
    id: legs.map((leg) => `${leg.offer.id}-${leg.date}`).join('__'),
    legs,
    totalMiles,
    cabinClass: cabins.length === 1 ? cabins[0] : 'Mixed cabin',
    airlines: [...new Set(legs.map((leg) => leg.offer.airline))],
  };
}

export function searchItineraries(offers, criteria) {
  const isAnywhereSearch = criteria.destination === 'Anywhere';
  const outbound = offers.filter(
    (offer) =>
      offer.origin === criteria.origin &&
      (isAnywhereSearch || offer.destination === criteria.destination) &&
      matchesFilters(offer, criteria) &&
      isOfferAvailable(offer, criteria.departureDate),
  );

  let itineraries;
  if (criteria.tripType === 'one-way') {
    itineraries = outbound.map((offer) =>
      itineraryFromLegs([{ offer, date: criteria.departureDate }]),
    );
  } else {
    itineraries = outbound.flatMap((outboundOffer) =>
      offers
        .filter(
          (offer) =>
            offer.origin === outboundOffer.destination &&
            offer.destination === criteria.origin &&
            matchesFilters(offer, criteria) &&
            isOfferAvailable(offer, criteria.returnDate),
        )
        .map((inboundOffer) =>
        itineraryFromLegs([
          { offer: outboundOffer, date: criteria.departureDate },
          { offer: inboundOffer, date: criteria.returnDate },
        ]),
        ),
    );
  }

  return itineraries
    .filter((itinerary) => !criteria.maxMiles || itinerary.totalMiles <= criteria.maxMiles)
    .sort((left, right) => left.totalMiles - right.totalMiles || left.id.localeCompare(right.id));
}

export function formatMiles(value) {
  return new Intl.NumberFormat('en-SG').format(value);
}

export function formatTravelDate(value, includeYear = false) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-SG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}
