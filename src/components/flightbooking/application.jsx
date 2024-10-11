import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Application from "./application.module.scss";
import Progress from "./progress.module.scss";
import SeatStyles from "./seat.module.scss";
import Seat from "./seat";
import Ailse from "./ailse";
import PlaneBG from "./plane.svg";
import { passengerData, makeRandomOrder } from "./data";
import { useFireproof } from "use-fireproof"

const formatPenniesAsDollarString = (pennies) => {
  return `$${(pennies / 100).toFixed(2)}`;
}

const FlightBooking = () => {
  const [currentSeat, setSeat] = useState('Please select');
  const seatRefs = useRef({});
  const emojiRef = useRef(null);
  const seatContainerRef = useRef(null);

  const firstPathSegment = document.location.pathname.split('/')[1];
  const dbName = (import.meta.env.VITE_DBNAME || 'flsv') + (firstPathSegment ? '-' + firstPathSegment : '');

  const { database, useLiveQuery } = useFireproof(dbName);

  const orders = useLiveQuery((doc, emit) => {
    if (doc.seat && !doc.delivered) {
      emit(doc.seat);
    }
  });
  const selectedOrdersQuery = useLiveQuery((doc, emit) => {
    if (doc.seat) {
      emit(doc.seat);
    }
  }, { key: currentSeat });
  const selectedOrders = selectedOrdersQuery.docs;

  const deliveredOrders = useLiveQuery((doc, emit) => {
    if (doc.seat && doc.delivered) {
      emit(doc.seat);
    }
  });

  const mostExpensiveItemEmojiPerSeat = useMemo(() => {
    return deliveredOrders.docs.reduce((acc, order) => {
      if (order.createdAt && (order.createdAt < Date.now() - 1000 * 60 * 5)) {
        return acc;
      }
      const mostExpensiveBeverage = order.beverages.reduce((max, beverage) => beverage.price > max.price ? beverage : max, order.beverages[0]);
      const mostExpensiveFood = order.foods.reduce((max, food) => food.price > max.price ? food : max, order.foods[0]);
      const mostExpensiveItem = mostExpensiveBeverage.price > mostExpensiveFood.price ? mostExpensiveBeverage : mostExpensiveFood;
      acc[order.seat] = mostExpensiveItem.item;
      return acc;
    }, {});
  }, [deliveredOrders]);

  const businessClassSeats = useMemo(() => new Set([
    'A1', 'A2', 'A3', 'A4', 'A5', 'A6',
    'B1', 'B2', 'B3', 'B4', 'B5', 'B6',
    'C1', 'C2', 'C3', 'C4', 'C5', 'C6',
  ]), []);

  const moveEmojiToSeat = useCallback((seatId) => {
    const seatElement = seatRefs.current[seatId];
    if (seatElement && emojiRef.current && seatContainerRef.current) {
      const seatRect = seatElement.getBoundingClientRect();
      const containerRect = seatContainerRef.current.getBoundingClientRect();
      const offsetTop = seatRect.top - containerRect.top;

      const isBusinessClass = businessClassSeats.has(seatId);

      const seatNumberMatch = seatId.match(/\d+/);
      const seatNumber = seatNumberMatch ? seatNumberMatch[0] : null;

      let leftPosition;

      if (isBusinessClass) {
        if (['1', '2', '3'].includes(seatNumber)) {
          leftPosition = '19%';
        } else {
          leftPosition = '50%';
        }
      } else {
        if (['1', '2', '3', '4'].includes(seatNumber)) {
          leftPosition = '13%';
        } else {
          leftPosition = '56%';
        }
      }

      emojiRef.current.style.top = `${offsetTop}px`;
      emojiRef.current.style.left = leftPosition;
    }
  }, [businessClassSeats]);

  useEffect(() => {
    moveEmojiToSeat('A1');

    const randomDelay = () => Math.floor(Math.random() * 10000) + 2000;

    const createRandomOrder = () => {
      const randomOrder = makeRandomOrder();
      database.put(randomOrder);
      timeoutId = setTimeout(createRandomOrder, randomDelay());
    };

    let timeoutId = setTimeout(createRandomOrder, randomDelay());

    return () => {
      clearTimeout(timeoutId);
    };
  }, [database, moveEmojiToSeat]);

  useEffect(() => {
    moveEmojiToSeat(currentSeat);
    let innerTimeoutId;
    const timeout = setTimeout(() => {
      selectedOrders.forEach(order => {
        database.put({ ...order, delivered: true });
      });
      innerTimeoutId = setTimeout(() => {
        const randomDoc = orders.docs[Math.floor(Math.random() * orders.docs.length)];
        if (!randomDoc) return;
        const randomSeat = randomDoc.seat;
        setSeat(randomSeat);
      }, Math.floor(Math.random() * 9000) + 5000);
    }, 1000);
    return () => {
      clearTimeout(timeout);
      // clearTimeout(innerTimeoutId);
    }
  }, [currentSeat, moveEmojiToSeat, selectedOrders, database]);

  const currentPassenger = passengerData.find(passenger => passenger.seat === currentSeat)?.name || 'Please select';
  const isNotSelected = currentPassenger === 'Please select';

  // console.log(currentSeat, currentPassenger, selectedOrders, orders);

  return (
    <div className={Application.container}>
      <div className={Application.logo} />
      <div className={Application.progress}>
        <ol className={Progress.steps}>
          <li className={Progress.complete}>
            <div className={Progress.label}>First Class</div>
          </li>
          <li className={Progress.complete}>
            <div className={Progress.label}>Business Elite</div>
          </li>
          <li className={Progress.current}>
            <div className={Progress.label}>Comfort Plus</div>
          </li>
          <li>
            <div className={Progress.label}>Economy</div>
          </li>
          <li>
            <div className={Progress.label}>Crew</div>
          </li>
        </ol>
      </div>
      <div className={Application.main}>
        <h1>In-flight Service</h1>
        <table className={Application.table} cellSpacing="0">
          <thead>
            <tr>
              <th>Passenger</th>
              <th>Seat</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{currentPassenger}</td>
              <td>{currentSeat}</td>
            </tr>
          </tbody>
        </table>
        <h2>Order Items</h2>
        <table className={Application.table} cellSpacing="0">
          <thead>
            <tr>
              <th>Item</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {selectedOrders.map((order, index) => (
              <React.Fragment key={index}>
                <tr>
                  <td colSpan="2" style={{ fontWeight: 'lighter', borderBottom: '1px solid #555', textAlign: 'left' }}>
                    Order: {order._id.slice(-7)}
                  </td>
                </tr>
                {order.beverages.map((beverage, idx) => (
                  <tr key={`bev-${idx}`}>
                    <td style={{ fontSize: '24px' }}>{beverage.item}</td>
                    <td>{formatPenniesAsDollarString(beverage.price)}</td>
                  </tr>
                ))}
                {order.foods.map((food, idx) => (
                  <tr key={`food-${idx}`}>
                    <td style={{ fontSize: '24px' }}>{food.item}</td>
                    <td>{formatPenniesAsDollarString(food.price)}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
            <tr>
              <td style={{ borderTop: '1px solid #333' }}>Total</td>
              <td style={{ fontWeight: 'bold', borderTop: '1px solid #555' }}>{formatPenniesAsDollarString(selectedOrders.reduce((sum, order) => sum + order.total, 0))}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {/* <div className={Application.footer}>
        <div className={Application.summary}>
          <h3>Selected seat:</h3>
          {isNotSelected ? (
            <p>&nbsp;</p>
          ) : (
            <p>{currentSeat}</p>
          )}
        </div>
        <button disabled={isNotSelected}>Continue</button>
      </div> */}
      <div className={Application.seatpicker}>
        <div
          className={Application.plane}
          ref={seatContainerRef}
          style={{ position: 'relative' }}
        >
          <div className={SeatStyles.container}>
            <div className={SeatStyles.business}>
              {["A1", "A2", "a", "A3", "A4", "a", "A5", "A6", "B1", "B2", "a", "B3", "B4", "a", "B5", "B6", "C1", "C2", "a", "C3", "C4", "a", "C5", "C6"].map((seat, index) => {
                if (seat === "a") {
                  return <Ailse key={index} />;
                } else {
                  const available = orders.docs.some(order => order.seat === seat);
                  const mostExpensiveItem = mostExpensiveItemEmojiPerSeat[seat];
                  return (
                    <Seat
                      key={seat}
                      setSeat={setSeat}
                      currentSeat={currentSeat}
                      seat={seat}
                      available={available}
                      forwardedRef={(ref) => (seatRefs.current[seat] = ref)}
                      mostExpensiveItem={mostExpensiveItem}
                    />
                  );
                }
              })}
            </div>
            <div className={SeatStyles.economy}>
              {["D1", "D2", "a", "D3", "D4", "D5", "D6", "a", "D7", "D8", "E1", "E2", "a", "E3", "E4", "E5", "E6", "a", "E7", "E8", "F1", "F2", "a", "F3", "F4", "F5", "F6", "a", "F7", "F8", "G1", "G2", "a", "G3", "G4", "G5", "G6", "a", "G7", "G8", "H1", "H2", "a", "H3", "H4", "H5", "H6", "a", "H7", "H8"].map((seat, index) => {
                if (seat === "a") {
                  return <Ailse key={index} />;
                } else {
                  const available = orders.docs.some(order => order.seat === seat);
                  const mostExpensiveItem = mostExpensiveItemEmojiPerSeat[seat];
                  return (
                    <Seat
                      key={seat}
                      setSeat={setSeat}
                      currentSeat={currentSeat}
                      seat={seat}
                      available={available}
                      forwardedRef={(ref) => (seatRefs.current[seat] = ref)}
                      mostExpensiveItem={mostExpensiveItem}
                    />
                  );
                }
              })}
            </div>
            <div className={SeatStyles.economy}>
              {["I1", "I2", "a", "I3", "I4", "I5", "I6", "a", "I7", "I8", "J1", "J2", "a", "J3", "J4", "J5", "J6", "a", "J7", "J8", "K1", "K2", "a", "K3", "K4", "K5", "K6", "a", "K7", "K8"].map((seat, index) => {
                if (seat === "a") {
                  return <Ailse key={index} />;
                } else {
                  const available = orders.docs.some(order => order.seat === seat);
                  const mostExpensiveItem = mostExpensiveItemEmojiPerSeat[seat];
                  return (
                    <Seat
                      key={seat}
                      setSeat={setSeat}
                      currentSeat={currentSeat}
                      seat={seat}
                      available={available}
                      forwardedRef={(ref) => (seatRefs.current[seat] = ref)}
                      mostExpensiveItem={mostExpensiveItem}
                    />
                  );
                }
              })}
            </div>
          </div>
          <img src={PlaneBG} alt="Plane" className={Application.plane_bg} />
          <div
            ref={emojiRef}
            style={{
              position: 'absolute',
              top: '120px',
              left: '56%',
              transform: 'translateX(80%)',
              zIndex: '1000',
              fontSize: '40px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'white',
              borderRadius: '50%',
              transition: 'top 0.5s ease-in-out, left 0.5s ease-in-out',
            }}
          >
            🧑‍✈️
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlightBooking;