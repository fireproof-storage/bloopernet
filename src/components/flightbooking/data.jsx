export { passengerData, makeRandomOrder };

function getRandomSeat() {
  const availableSeats = passengerData.filter(passenger => passenger.name === null);
  if (availableSeats.length === 0) {
    return null; // No available seats
  }
  const randomIndex = Math.floor(Math.random() * availableSeats.length);
  return availableSeats[randomIndex].seat;
}

function makeRandomOrder() {
  const randomBeverage = beverages[Math.floor(Math.random() * beverages.length)];
  const randomFood = food[Math.floor(Math.random() * food.length)];
  return {
    beverage: randomBeverage,
    food: randomFood,
    total: randomBeverage.price + randomFood.price,
    seat: getRandomSeat()
  };
}

const beverages = [
  { item: '☕️', price: 300 },
  { item: '🍺', price: 500 },
  { item: '🍷', price: 700 },
  { item: '🥂', price: 800 },
  { item: '🍾', price: 1200 },
  { item: '🧃', price: 250 }
];

const food = [
  { item: '🍔', price: 600 },
  { item: '🥗', price: 450 },
  { item: '🥪', price: 550 },
  { item: '🥙', price: 650 },
  { item: '🌯', price: 700 },
  { item: '🍦', price: 300 }
];
const passengerData = [
  { seat: "A1", name: "Brett Jones" },
  { seat: "A2", name: "Sarah Smith" },
  { seat: "A3", name: "Michael Brown" },
  { seat: "A4", name: "Emily Davis" },
  { seat: "A5", name: "David Wilson" },
  { seat: "A6", name: "Sophia Johnson" },
  { seat: "B1", name: "James Taylor" },
  { seat: "B2", name: "Olivia Martinez" },
  { seat: "B3", name: "John Anderson" },
  { seat: "B4", name: "Emma Thomas" },
  { seat: "B5", name: "Robert Jackson" },
  { seat: "B6", name: "Isabella White" },
  { seat: "C1", name: "William Harris" },
  { seat: "C2", name: "Mia Martin" },
  { seat: "C3", name: "Alexander Thompson" },
  { seat: "C4", name: "Charlotte Garcia" },
  { seat: "C5", name: "Daniel Martinez" },
  { seat: "C6", name: "Amelia Robinson" },
  { seat: "D1", name: "Matthew Clark" },
  { seat: "D2", name: "Harper Lewis" },
  { seat: "D3", name: "Joseph Lee" },
  { seat: "D4", name: "Evelyn Walker" },
  { seat: "D5", name: "Christopher Hall" },
  { seat: "D6", name: "Abigail Allen" },
  { seat: "D7", name: null },
  { seat: "D8", name: "Liam Scott" },
  { seat: "E1", name: "Henry Adams" },
  { seat: "E2", name: "Grace Nelson" },
  { seat: "E3", name: "Samuel Carter" },
  { seat: "E4", name: "Victoria Mitchell" },
  { seat: "E5", name: "Jack Perez" },
  { seat: "E6", name: "Avery Roberts" },
  { seat: "E7", name: null },
  { seat: "E8", name: "Ella Turner" },
  { seat: "F1", name: "Lucas Phillips" },
  { seat: "F2", name: "Chloe Campbell" },
  { seat: "F3", name: "Mason Parker" },
  { seat: "F4", name: "Lily Evans" },
  { seat: "F5", name: "Ethan Edwards" },
  { seat: "F6", name: "Sofia Collins" },
  { seat: "F7", name: null },
  { seat: "F8", name: "Aiden Stewart" },
  { seat: "G1", name: "Daniel Sanchez" },
  { seat: "G2", name: "Aria Morris" },
  { seat: "G3", name: "Logan Rogers" },
  { seat: "G4", name: "Zoe Reed" },
  { seat: "G5", name: "Jackson Cook" },
  { seat: "G6", name: "Layla Morgan" },
  { seat: "G7", name: null },
  { seat: "G8", name: "Sebastian Bell" },
  { seat: "H1", name: "Carter Murphy" },
  { seat: "H2", name: "Riley Bailey" },
  { seat: "H3", name: "Jayden Rivera" },
  { seat: "H4", name: "Nora Cooper" },
  { seat: "H5", name: "Gabriel Richardson" },
  { seat: "H6", name: "Scarlett Cox" },
  { seat: "H7", name: null },
  { seat: "H8", name: "Owen Howard" },
  { seat: "I1", name: "Julian Ward" },
  { seat: "I2", name: "Hannah Torres" },
  { seat: "I3", name: "Levi Peterson" },
  { seat: "I4", name: "Lillian Gray" },
  { seat: "I5", name: "Isaac Ramirez" },
  { seat: "I6", name: "Ellie James" },
  { seat: "I7", name: null },
  { seat: "I8", name: "Wyatt Watson" },
  { seat: "J1", name: "Nathan Brooks" },
  { seat: "J2", name: "Aubrey Kelly" },
  { seat: "J3", name: "Caleb Sanders" },
  { seat: "J4", name: "Zoey Price" },
  { seat: "J5", name: "Ryan Bennett" },
  { seat: "J6", name: "Stella Wood" },
  { seat: "J7", name: null },
  { seat: "J8", name: "Luke Barnes" },
  { seat: "K1", name: "Isaiah Ross" },
  { seat: "K2", name: "Penelope Henderson" },
  { seat: "K3", name: "Adam Coleman" },
  { seat: "K4", name: "Aurora Jenkins" },
  { seat: "K5", name: "Eli Perry" },
  { seat: "K6", name: "Savannah Powell" },
  { seat: "K7", name: null },
  { seat: "K8", name: "David Long" },
];

