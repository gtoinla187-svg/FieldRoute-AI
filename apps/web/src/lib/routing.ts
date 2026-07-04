export type RouteStopInput = {
  id: string;
  name: string | null;
  address: string | null;
  duration_minutes: number | null;
  notes: string | null;
  position: number | null;
};

export type TimelineEvent = {
  stopId: string;
  name: string;
  address: string;
  notes: string | null;
  originalPosition: number;
  newPosition: number;
  
  travelDistanceKm: number;
  travelTimeMinutes: number;
  
  arrivalTime: string; // ISO string or local time format
  prepBufferStart: string;
  prepBufferEnd: string;
  visitStart: string;
  visitEnd: string;
  wrapUpBufferStart: string;
  wrapUpBufferEnd: string;
  departureTime: string;
};

export type RouteSummary = {
  totalDistanceKm: number;
  totalTravelTimeMinutes: number;
  totalVisitTimeMinutes: number;
  totalBufferTimeMinutes: number;
  totalDurationMinutes: number;
  endArrival: string;
};

export type OptimizeRouteResult = {
  timeline: TimelineEvent[];
  summary: RouteSummary;
};

function getZipCoordinates(zipStr: string): { lat: number; lng: number } | null {
  const prefix = parseInt(zipStr.substring(0, 2), 10);
  if (Number.isNaN(prefix)) return null;

  if (prefix >= 0 && prefix <= 2) return { lat: 42.3, lng: -71.5 };
  if (prefix >= 3 && prefix <= 4) return { lat: 41.5, lng: -72.7 };
  if (prefix >= 5 && prefix <= 8) return { lat: 43.0, lng: -71.5 };
  if (prefix >= 10 && prefix <= 14) return { lat: 40.8, lng: -74.0 };
  if (prefix >= 15 && prefix <= 19) return { lat: 40.8, lng: -77.9 };
  if (prefix >= 20 && prefix <= 21) return { lat: 39.0, lng: -76.7 };
  if (prefix >= 22 && prefix <= 24) return { lat: 37.5, lng: -78.5 };
  if (prefix >= 25 && prefix <= 26) return { lat: 38.6, lng: -80.6 };
  if (prefix >= 27 && prefix <= 28) return { lat: 35.5, lng: -80.0 };
  if (prefix >= 29 && prefix <= 29) return { lat: 33.9, lng: -81.0 };
  if (prefix >= 30 && prefix <= 31) return { lat: 32.8, lng: -83.5 };
  if (prefix >= 32 && prefix <= 34) return { lat: 28.0, lng: -81.8 };
  if (prefix >= 35 && prefix <= 36) return { lat: 32.8, lng: -86.8 };
  if (prefix >= 37 && prefix <= 38) return { lat: 35.7, lng: -86.3 };
  if (prefix >= 39 && prefix <= 39) return { lat: 32.7, lng: -89.7 };
  if (prefix >= 40 && prefix <= 42) return { lat: 37.8, lng: -84.3 };
  if (prefix >= 43 && prefix <= 45) return { lat: 40.4, lng: -82.9 };
  if (prefix >= 46 && prefix <= 47) return { lat: 39.8, lng: -86.1 };
  if (prefix >= 48 && prefix <= 49) return { lat: 44.3, lng: -85.6 };
  if (prefix >= 50 && prefix <= 52) return { lat: 42.0, lng: -93.5 };
  if (prefix >= 53 && prefix <= 54) return { lat: 44.5, lng: -89.5 };
  if (prefix >= 55 && prefix <= 56) return { lat: 46.0, lng: -94.0 };
  if (prefix >= 57 && prefix <= 57) return { lat: 44.4, lng: -100.2 };
  if (prefix >= 58 && prefix <= 58) return { lat: 47.5, lng: -100.5 };
  if (prefix >= 59 && prefix <= 59) return { lat: 47.0, lng: -110.0 };
  if (prefix >= 60 && prefix <= 62) return { lat: 40.0, lng: -89.0 };
  if (prefix >= 63 && prefix <= 65) return { lat: 38.5, lng: -92.5 };
  if (prefix >= 66 && prefix <= 67) return { lat: 38.5, lng: -98.0 };
  if (prefix >= 68 && prefix <= 69) return { lat: 41.5, lng: -99.8 };
  if (prefix >= 70 && prefix <= 71) return { lat: 31.0, lng: -92.0 };
  if (prefix >= 72 && prefix <= 72) return { lat: 34.8, lng: -92.2 };
  if (prefix >= 73 && prefix <= 74) return { lat: 35.5, lng: -97.5 };
  if (prefix >= 75 && prefix <= 79) return { lat: 31.5, lng: -99.5 };
  if (prefix >= 80 && prefix <= 81) return { lat: 39.0, lng: -105.5 };
  if (prefix >= 82 && prefix <= 83) return { lat: 43.0, lng: -107.3 };
  if (prefix >= 84 && prefix <= 84) return { lat: 39.5, lng: -111.5 };
  if (prefix >= 85 && prefix <= 86) return { lat: 34.5, lng: -111.5 };
  if (prefix >= 87 && prefix <= 88) return { lat: 34.5, lng: -106.0 };
  if (prefix >= 89 && prefix <= 89) return { lat: 39.0, lng: -117.0 };
  if (prefix >= 90 && prefix <= 93) return { lat: 34.05, lng: -118.25 };
  if (prefix >= 94 && prefix <= 95) return { lat: 37.77, lng: -122.42 };
  if (prefix >= 96 && prefix <= 96) return { lat: 37.77, lng: -122.42 };
  if (prefix >= 97 && prefix <= 97) return { lat: 44.0, lng: -120.5 };
  if (prefix >= 98 && prefix <= 98) return { lat: 47.5, lng: -120.5 };
  if (prefix >= 99 && prefix <= 99) return { lat: 61.0, lng: -150.0 };
  return null;
}

// Deterministically generate a mock latitude and longitude for any address string
export function getMockLatLng(address: string): { lat: number; lng: number } {
  const cleanAddress = (address || "").trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < cleanAddress.length; i++) {
    hash = cleanAddress.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  let baseCoords = { lat: 37.70, lng: -122.52 }; // Default SF
  let hasSpecificCoords = false;

  // City-aware coordinates
  if (cleanAddress.includes("irvine")) {
    baseCoords = { lat: 33.6846, lng: -117.8265 };
    hasSpecificCoords = true;
  } else if (cleanAddress.includes("ontario")) {
    baseCoords = { lat: 34.0633, lng: -117.6509 };
    hasSpecificCoords = true;
  } else if (cleanAddress.includes("chino")) {
    baseCoords = { lat: 34.0122, lng: -117.6889 };
    hasSpecificCoords = true;
  } else if (cleanAddress.includes("industry")) {
    baseCoords = { lat: 34.0197, lng: -117.9587 };
    hasSpecificCoords = true;
  } else if (cleanAddress.includes("brea")) {
    baseCoords = { lat: 33.9167, lng: -117.9000 };
    hasSpecificCoords = true;
  } else if (cleanAddress.includes("buena park")) {
    baseCoords = { lat: 33.8679, lng: -117.9981 };
    hasSpecificCoords = true;
  } else if (cleanAddress.includes("san diego")) {
    baseCoords = { lat: 32.7157, lng: -117.1611 };
    hasSpecificCoords = true;
  } else if (cleanAddress.includes("san francisco") || cleanAddress.includes(" sfo") || cleanAddress.endsWith(" sf")) {
    baseCoords = { lat: 37.7749, lng: -122.4194 };
    hasSpecificCoords = true;
  } else if (cleanAddress.includes("san jose")) {
    baseCoords = { lat: 37.3382, lng: -121.8863 };
    hasSpecificCoords = true;
  } else if (cleanAddress.includes("los angeles") || cleanAddress.includes(" lax")) {
    baseCoords = { lat: 34.0522, lng: -118.2437 };
    hasSpecificCoords = true;
  } else if (cleanAddress.includes("anaheim")) {
    baseCoords = { lat: 33.8366, lng: -117.9143 };
    hasSpecificCoords = true;
  } else if (cleanAddress.includes("riverside")) {
    baseCoords = { lat: 33.9533, lng: -117.3962 };
    hasSpecificCoords = true;
  } else if (cleanAddress.includes("corona")) {
    baseCoords = { lat: 33.8753, lng: -117.5664 };
    hasSpecificCoords = true;
  } else if (cleanAddress.includes("pasadena")) {
    baseCoords = { lat: 34.1478, lng: -118.1445 };
    hasSpecificCoords = true;
  } else if (cleanAddress.includes("long beach")) {
    baseCoords = { lat: 33.7701, lng: -118.1937 };
    hasSpecificCoords = true;
  } else if (cleanAddress.includes("santa ana")) {
    baseCoords = { lat: 33.7456, lng: -117.8678 };
    hasSpecificCoords = true;
  }

  if (!hasSpecificCoords) {
    const zipMatches = cleanAddress.match(/\b\d{5}\b/g);
    if (zipMatches && zipMatches.length > 0) {
      const zipStr = zipMatches[zipMatches.length - 1];
      const zipCoords = getZipCoordinates(zipStr);
      if (zipCoords) {
        baseCoords = { lat: zipCoords.lat - 0.2, lng: zipCoords.lng - 0.2 };
        hasSpecificCoords = true;
      }
    }
  }

  // Dispersion based on hash: localized small dispersion for city-aware, otherwise larger
  const scale = hasSpecificCoords ? 0.05 : 1.5;
  const latOffset = ((Math.abs(hash % 30000) / 100000) - 0.15) * scale;
  const lngOffset = ((Math.abs((hash >> 3) % 40000) / 100000) - 0.20) * scale;
  
  return {
    lat: Number((baseCoords.lat + latOffset).toFixed(5)),
    lng: Number((baseCoords.lng + lngOffset).toFixed(5))
  };
}

// Calculate distance between two coordinates in kilometers using the Haversine formula
export function calculateDistance(
  c1: { lat: number; lng: number },
  c2: { lat: number; lng: number }
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((c2.lat - c1.lat) * Math.PI) / 180;
  const dLng = ((c2.lng - c1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((c1.lat * Math.PI) / 180) *
      Math.cos((c2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

// Deterministic Nearest Neighbor optimization starting at startAddress
export function optimizeStopSequence(
  startAddress: string,
  endAddress: string,
  stops: RouteStopInput[],
  startStrategy: "closest" | "furthest" = "closest"
): RouteStopInput[] {
  if (stops.length <= 1) return stops;

  const startCoords = getMockLatLng(startAddress);
  const endCoords = getMockLatLng(endAddress);
  const remaining = [...stops];

  let firstStopIdx = 0;
  if (startStrategy === "furthest") {
    let maxDistance = -1;
    for (let i = 0; i < remaining.length; i++) {
      const addr = remaining[i].address || "";
      const stopCoords = getMockLatLng(addr);
      const dist = calculateDistance(startCoords, stopCoords);
      if (dist > maxDistance) {
        maxDistance = dist;
        firstStopIdx = i;
      }
    }
  } else {
    let minDistance = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const addr = remaining[i].address || "";
      const stopCoords = getMockLatLng(addr);
      const dist = calculateDistance(startCoords, stopCoords);
      if (dist < minDistance) {
        minDistance = dist;
        firstStopIdx = i;
      }
    }
  }

  const firstStop = remaining.splice(firstStopIdx, 1)[0];
  const firstCoords = getMockLatLng(firstStop.address || "");

  let bestSequence: RouteStopInput[] = [];
  let minTotalDist = Infinity;

  const getSequenceDistance = (seq: RouteStopInput[]) => {
    let dist = 0;
    let current = firstCoords;
    for (const stop of seq) {
      const nextCoords = getMockLatLng(stop.address || "");
      dist += calculateDistance(current, nextCoords);
      current = nextCoords;
    }
    dist += calculateDistance(current, endCoords);
    return dist;
  };

  if (remaining.length <= 8) {
    const permute = (arr: RouteStopInput[], memo: RouteStopInput[] = []) => {
      if (arr.length === 0) {
        const d = getSequenceDistance(memo);
        if (d < minTotalDist) {
          minTotalDist = d;
          bestSequence = [...memo];
        }
        return;
      }
      for (let i = 0; i < arr.length; i++) {
        const current = arr.splice(i, 1);
        permute(arr.slice(), memo.concat(current));
        arr.splice(i, 0, current[0]);
      }
    };
    permute(remaining);
  } else {
    let current = firstCoords;
    const tempRemaining = [...remaining];
    while (tempRemaining.length > 0) {
      let closestIdx = 0;
      let minDist = Infinity;
      for (let i = 0; i < tempRemaining.length; i++) {
        const dist = calculateDistance(current, getMockLatLng(tempRemaining[i].address || ""));
        if (dist < minDist) {
          minDist = dist;
          closestIdx = i;
        }
      }
      const next = tempRemaining.splice(closestIdx, 1)[0];
      bestSequence.push(next);
      current = getMockLatLng(next.address || "");
    }
  }

  return [firstStop, ...bestSequence];
}

export type LunchOption = {
  id: string;
  name: string;
  address: string;
  description: string;
};

export function getStreetName(address: string): string {
  if (!address) return "Main St";
  const decoded = decodeURIComponent(address);
  const parts = decoded.split(",");
  const streetPart = parts[0] ? parts[0].trim() : "";
  if (streetPart) {
    const words = streetPart.split(" ");
    if (words.length > 1 && /^\d+/.test(words[0])) {
      return words.slice(1).join(" ");
    }
    return streetPart;
  }
  return "Main St";
}

export function getLunchOptions(prevAddress: string, nextAddress: string): LunchOption[] {
  const decoded = decodeURIComponent(nextAddress || "450 Main St, Fremont, CA");
  
  // Parse parts of the next address
  const parts = decoded.split(",");
  const streetPart = parts[0] || "450 Main St";
  const cityPart = parts[1] ? parts[1].trim() : "Fremont";
  const stateZipPart = parts[2] ? parts[2].trim() : "CA 94539";
  
  // Clean unit numbers (e.g. Suite, Apt, #, Ste, Unit, Rd. 200, etc.) from streetPart
  const cleanStreet = streetPart.replace(/\b(ste|suite|apt|unit|room|rm|#|\.\s*\d+)\b.*$/i, "").trim();
  
  // Extract street number and street name
  const streetNumMatch = cleanStreet.match(/^(\d+)\s+(.+)$/);
  let streetName = cleanStreet;
  let originalNumber = "123";
  if (streetNumMatch) {
    originalNumber = streetNumMatch[1];
    streetName = streetNumMatch[2].trim();
  }
  
  // Helper to construct address with a modified number
  const makeAddress = (num: string) => {
    return `${num} ${streetName}, ${cityPart}, ${stateZipPart}`;
  };

  // Generate 3 alternative numbers that are on the same street
  const baseNumVal = parseInt(originalNumber, 10) || 100;
  const num1 = String(baseNumVal + 15);
  const num2 = String(Math.max(10, baseNumVal - 20));
  const num3 = String(baseNumVal + 40);

  return [
    {
      id: "cafe",
      name: "Panera Bread (Quick)",
      address: makeAddress(num1),
      description: "[Quick Type] Conveniently located along the forward route (no back traffic)"
    },
    {
      id: "salad",
      name: "Chipotle Mexican Grill (Healthy)",
      address: makeAddress(num2),
      description: "[Healthy Type] Directly along the forward route (no U-turn)"
    },
    {
      id: "deli",
      name: "Subway (Light)",
      address: makeAddress(num3),
      description: "[Light Type] Located along the forward route to next stop (no backtracking)"
    }
  ];
}

// Calculate the complete itinerary timeline
export function calculateTimeline(
  startAddress: string,
  endAddress: string,
  startTimeIso: string,
  optimizedStops: RouteStopInput[],
  prepBufferMinutes: number = 3,
  skipLunch: boolean = false,
  selectedLunchOption: string = "salad"
): OptimizeRouteResult {
  const tripDate = new Date(startTimeIso);
  const lunchTime = new Date(tripDate);
  if (Number.isNaN(lunchTime.getTime())) {
    lunchTime.setTime(new Date().getTime());
  }
  lunchTime.setHours(12, 30, 0, 0);

  // Dry run to find departure times of gaps
  let dryRunTime = new Date(startTimeIso);
  if (Number.isNaN(dryRunTime.getTime())) {
    dryRunTime = new Date();
  }

  const gapStartTimes: Date[] = [new Date(dryRunTime)];
  let dryPrevAddress = startAddress;

  optimizedStops.forEach((stop) => {
    const stopAddress = stop.address || "";
    const cPrev = getMockLatLng(dryPrevAddress);
    const cCurr = getMockLatLng(stopAddress);
    const distance = calculateDistance(dryPrevAddress === startAddress ? getMockLatLng(dryPrevAddress) : getMockLatLng(dryPrevAddress), getMockLatLng(stopAddress));
    const travelTime = Math.max(2, Math.round(distance * 0.573));
    
    const arrivalTime = new Date(dryRunTime.getTime() + travelTime * 60 * 1000);
    const duration = stop.duration_minutes || 30;
    // departure = arrival + prepBufferMinutes mins prep + duration + 3 mins wrap-up
    const departureTime = new Date(arrivalTime.getTime() + (prepBufferMinutes + duration + 3) * 60 * 1000);
    
    gapStartTimes.push(new Date(departureTime));
    dryRunTime = departureTime;
    dryPrevAddress = stopAddress;
  });

  // Find the gap index closest to 12:30 PM
  let bestGapIdx = -1;
  if (!skipLunch && optimizedStops.length > 0) {
    let minDiff = Infinity;
    bestGapIdx = 0;
    gapStartTimes.forEach((time, index) => {
      const diff = Math.abs(time.getTime() - lunchTime.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        bestGapIdx = index;
      }
    });
  }

  const timeline: TimelineEvent[] = [];
  let currentTimestamp = new Date(startTimeIso);
  if (Number.isNaN(currentTimestamp.getTime())) {
    currentTimestamp = new Date();
  }

  let previousAddress = startAddress;
  let totalDistance = 0;
  let totalTravelTime = 0;
  let totalVisitTime = 0;
  let totalBufferTime = 0;

  // Insert lunch break at gap 0 if bestGapIdx is 0
  if (optimizedStops.length > 0 && bestGapIdx === 0) {
    const nextStopAddress = optimizedStops[0].address || endAddress;
    const options = getLunchOptions(startAddress, nextStopAddress);
    const chosenLunch = options.find(o => o.id === selectedLunchOption) || options[0];
    const lunchAddress = chosenLunch.address;

    const cPrev = getMockLatLng(startAddress);
    const cLunch = getMockLatLng(lunchAddress);
    const distToLunch = calculateDistance(cPrev, cLunch);
    const timeToLunch = Math.max(2, Math.round(distToLunch * 0.573));

    const lunchStart = new Date(currentTimestamp.getTime() + timeToLunch * 60 * 1000);
    const lunchEnd = new Date(lunchStart.getTime() + 60 * 60 * 1000);
    
    timeline.push({
      stopId: "lunch-break",
      name: `Lunch: ${chosenLunch.name}`,
      address: lunchAddress,
      notes: chosenLunch.description || "Logical lunch break",
      originalPosition: -1,
      newPosition: -1,
      
      travelDistanceKm: distToLunch,
      travelTimeMinutes: timeToLunch,
      
      arrivalTime: lunchStart.toISOString(),
      prepBufferStart: lunchStart.toISOString(),
      prepBufferEnd: lunchStart.toISOString(),
      visitStart: lunchStart.toISOString(),
      visitEnd: lunchEnd.toISOString(),
      wrapUpBufferStart: lunchEnd.toISOString(),
      wrapUpBufferEnd: lunchEnd.toISOString(),
      departureTime: lunchEnd.toISOString(),
    });
    
    totalDistance += distToLunch;
    totalTravelTime += timeToLunch;
    currentTimestamp = lunchEnd;
    previousAddress = lunchAddress;
  }

  optimizedStops.forEach((stop, index) => {
    const stopAddress = stop.address || "";
    const cPrev = getMockLatLng(previousAddress);
    const cCurr = getMockLatLng(stopAddress);
    
    // Calculate travel metrics
    const distance = calculateDistance(cPrev, cCurr);
    const travelTime = Math.max(2, Math.round(distance * 0.573));
    
    totalDistance += distance;
    totalTravelTime += travelTime;

    // Departure time from previous location
    const departureFromPrev = new Date(currentTimestamp);
    
    // Arrive at current stop
    const arrivalTime = new Date(departureFromPrev.getTime() + travelTime * 60 * 1000);
    
    // Prep/Parking Buffer
    const prepBufferStart = new Date(arrivalTime);
    const prepBufferEnd = new Date(prepBufferStart.getTime() + prepBufferMinutes * 60 * 1000);
    
    // Visit starts
    const visitStart = new Date(prepBufferEnd);
    const duration = stop.duration_minutes || 30;
    const visitEnd = new Date(visitStart.getTime() + duration * 60 * 1000);
    totalVisitTime += duration;

    // 3-minute Wrap-up/Departure Buffer
    const wrapUpBufferStart = new Date(visitEnd);
    const wrapUpBufferEnd = new Date(wrapUpBufferStart.getTime() + 3 * 60 * 1000);
    totalBufferTime += (prepBufferMinutes + 3); // prep Buffer + 3 mins wrap-up

    // Ready to depart current stop
    const departureTime = new Date(wrapUpBufferEnd);
    
    // Record timeline event
    timeline.push({
      stopId: stop.id,
      name: stop.name || "Unnamed Stop",
      address: stopAddress,
      notes: stop.notes,
      originalPosition: stop.position ?? index,
      newPosition: index,
      
      travelDistanceKm: distance,
      travelTimeMinutes: travelTime,
      
      arrivalTime: arrivalTime.toISOString(),
      prepBufferStart: prepBufferStart.toISOString(),
      prepBufferEnd: prepBufferEnd.toISOString(),
      visitStart: visitStart.toISOString(),
      visitEnd: visitEnd.toISOString(),
      wrapUpBufferStart: wrapUpBufferStart.toISOString(),
      wrapUpBufferEnd: wrapUpBufferEnd.toISOString(),
      departureTime: departureTime.toISOString(),
    });

    // Update state for next iteration
    currentTimestamp = departureTime;
    previousAddress = stopAddress;

    // If bestGapIdx matches this gap (after stop index + 1), insert lunch break
    if (index + 1 === bestGapIdx) {
      const nextStopAddress = index + 1 < optimizedStops.length ? (optimizedStops[index + 1].address || endAddress) : endAddress;
      const options = getLunchOptions(stopAddress, nextStopAddress);
      const chosenLunch = options.find(o => o.id === selectedLunchOption) || options[0];
      const lunchAddress = chosenLunch.address;

      const cPrev = getMockLatLng(stopAddress);
      const cLunch = getMockLatLng(lunchAddress);
      const distToLunch = calculateDistance(cPrev, cLunch);
      const timeToLunch = Math.max(2, Math.round(distToLunch * 0.573));

      const lunchStart = new Date(currentTimestamp.getTime() + timeToLunch * 60 * 1000);
      const lunchEnd = new Date(lunchStart.getTime() + 60 * 60 * 1000);
      
      timeline.push({
        stopId: "lunch-break",
        name: `Lunch: ${chosenLunch.name}`,
        address: lunchAddress,
        notes: chosenLunch.description || "Logical lunch break",
        originalPosition: -1,
        newPosition: -1,
        
        travelDistanceKm: distToLunch,
        travelTimeMinutes: timeToLunch,
        
        arrivalTime: lunchStart.toISOString(),
        prepBufferStart: lunchStart.toISOString(),
        prepBufferEnd: lunchStart.toISOString(),
        visitStart: lunchStart.toISOString(),
        visitEnd: lunchEnd.toISOString(),
        wrapUpBufferStart: lunchEnd.toISOString(),
        wrapUpBufferEnd: lunchEnd.toISOString(),
        departureTime: lunchEnd.toISOString(),
      });
      
      totalDistance += distToLunch;
      totalTravelTime += timeToLunch;
      currentTimestamp = lunchEnd;
      previousAddress = lunchAddress;
    }
  });

  // Finally, calculate travel from the last stop to the endAddress
  const cLast = getMockLatLng(previousAddress);
  const cEnd = getMockLatLng(endAddress);
  const finalDistance = calculateDistance(cLast, cEnd);
  const finalTravelTime = Math.max(2, Math.round(finalDistance * 0.573));
  
  totalDistance += finalDistance;
  totalTravelTime += finalTravelTime;
  
  const endArrival = new Date(currentTimestamp.getTime() + finalTravelTime * 60 * 1000);

  const hasLunch = !skipLunch && optimizedStops.length > 0;
  const totalDurationMinutes = totalTravelTime + totalVisitTime + totalBufferTime + (hasLunch ? 60 : 0);

  return {
    timeline,
    summary: {
      totalDistanceKm: Number(totalDistance.toFixed(2)),
      totalTravelTimeMinutes: totalTravelTime,
      totalVisitTimeMinutes: totalVisitTime,
      totalBufferTimeMinutes: totalBufferTime,
      totalDurationMinutes,
      endArrival: !Number.isNaN(endArrival.getTime()) ? endArrival.toISOString() : new Date().toISOString(),
    },
  };
}
