import assert from 'node:assert/strict';
import test from 'node:test';
import { isOfferAvailable, searchItineraries } from '../src/lib/search.js';

const offers = [
  {
    id: 'out-economy',
    airline: 'Scoot',
    origin: 'Singapore',
    destination: 'Bangkok',
    miles_required: 5000,
    cabin_class: 'Economy',
    blackout_dates: ['2026-10-03'],
  },
  {
    id: 'back-economy',
    airline: 'Scoot',
    origin: 'Bangkok',
    destination: 'Singapore',
    miles_required: 6000,
    cabin_class: 'Economy',
    blackout_dates: [],
  },
  {
    id: 'out-business',
    airline: 'Singapore Airlines',
    origin: 'Singapore',
    destination: 'Bangkok',
    miles_required: 15000,
    cabin_class: 'Business',
    blackout_dates: [],
  },
];

test('blackout dates make an otherwise valid offer unavailable', () => {
  assert.equal(isOfferAvailable(offers[0], '2026-10-03'), false);
  assert.equal(isOfferAvailable(offers[0], '2026-10-04'), true);
});

test('round-trip search combines outbound and inbound miles', () => {
  const results = searchItineraries(offers, {
    tripType: 'round-trip',
    origin: 'Singapore',
    destination: 'Bangkok',
    departureDate: '2026-10-04',
    returnDate: '2026-10-08',
    cabin: 'Economy',
    airline: 'Any',
    maxMiles: null,
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].totalMiles, 11000);
  assert.equal(results[0].legs.length, 2);
});

test('miles ceiling applies to the complete itinerary', () => {
  const results = searchItineraries(offers, {
    tripType: 'one-way',
    origin: 'Singapore',
    destination: 'Bangkok',
    departureDate: '2026-10-04',
    returnDate: '',
    cabin: 'Any',
    airline: 'Any',
    maxMiles: 10000,
  });
  assert.deepEqual(results.map((result) => result.totalMiles), [5000]);
});

test('Singapore to Anywhere returns every eligible destination', () => {
  const expandedOffers = [
    ...offers,
    {
      id: 'out-phuket',
      airline: 'Scoot',
      origin: 'Singapore',
      destination: 'Phuket',
      miles_required: 4000,
      cabin_class: 'Economy',
      blackout_dates: [],
    },
  ];
  const results = searchItineraries(expandedOffers, {
    tripType: 'one-way',
    origin: 'Singapore',
    destination: 'Anywhere',
    departureDate: '2026-10-04',
    returnDate: '',
    cabin: 'Economy',
    airline: 'Any',
    maxMiles: null,
  });
  assert.deepEqual(
    results.map((result) => result.legs[0].offer.destination),
    ['Phuket', 'Bangkok'],
  );
});

test('Anywhere round trips pair each outbound with its matching return route', () => {
  const results = searchItineraries(offers, {
    tripType: 'round-trip',
    origin: 'Singapore',
    destination: 'Anywhere',
    departureDate: '2026-10-04',
    returnDate: '2026-10-08',
    cabin: 'Economy',
    airline: 'Any',
    maxMiles: null,
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].legs[0].offer.destination, 'Bangkok');
  assert.equal(results[0].legs[1].offer.origin, 'Bangkok');
});
