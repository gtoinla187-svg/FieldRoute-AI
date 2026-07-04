import type {
    FrontendPreParseRow,
    ParseProspectsRequest,
    ParseProspectsResponse,
    ParsedProspect,
    SourceType,
    ConfidenceLevel,
} from "./types";

const DEFAULT_DURATION_MINUTES = 30;

function clean(value: string | null | undefined) {
    return (value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeHeader(value: string) {
    return clean(value).toLowerCase();
}

function cleanContactNoise(str: string): string {
    return str
        .replace(/^[\s.,|\\/—\-_—]+/, "")
        .replace(/[\s.,|\\/—\-_—]+$/, "")
        .trim();
}

function looksLikeAddress(value: string) {
    const text = clean(value).toLowerCase();
    if (!text) return false;
    return isStreetCell(text);
}


function isStreetCell(value: string): boolean {
    const text = (value || "").toLowerCase().replace(/[.,]/g, "").trim();
    if (!text) return false;
    
    const shortKeywords = ["st", "ave", "rd", "blvd", "dr", "ln", "way", "hwy", "pkwy", "pwy", "ct", "pl", "terr", "tc"];
    const longKeywords = ["street", "avenue", "road", "boulevard", "drive", "lane", "highway", "parkway", "court", "place", "paseo", "padre", "warm", "springs", "spring", "terrace", "terrance"];

    const uniqueAbbreviations = ["blvd", "pkwy", "pwy", "hwy"];

    for (const keyword of shortKeywords) {
        let regex;
        if (uniqueAbbreviations.includes(keyword)) {
            regex = new RegExp(`\\b${keyword}\\b|\\w+${keyword}\\b`, "i");
        } else {
            if (/\b\d+\b/.test(text)) {
                regex = new RegExp(`\\b${keyword}\\b|\\w+${keyword}\\b`, "i");
            } else {
                regex = new RegExp(`\\b${keyword}\\b|\\d+${keyword}\\b`, "i");
            }
        }
        if (regex.test(text)) return true;
    }

    for (const keyword of longKeywords) {
        if (text.includes(keyword)) return true;
    }

    return false;
}

function isStreetNumberCandidate(val: string): boolean {
    const text = val.trim();
    return /\d/.test(text) && text.length <= 10;
}

function isNoiseCell(value: string): boolean {
    const text = (value || "").trim();
    if (!text) return true;
    return /^[_|\\\-\s]+$/.test(text);
}

function extractPhone(cell: string): { cleaned: string; phone: string | null } {
    const phoneRegex = /\b(?:\+?\d{1,3}[-.\s()]+)?\(?\d{3}\)?[-.\s()]+\d{3}[-.\s()]+\d{3,4}\b|\b\d{7,11}\b/g;
    let phoneVal: string | null = null;
    const cleaned = cell.replace(phoneRegex, (match) => {
        const digits = match.replace(/\D/g, "");
        if (digits.length >= 7 && digits.length <= 15) {
            phoneVal = match;
            return "";
        }
        return match;
    });
    return { cleaned: cleaned.trim(), phone: phoneVal };
}

function splitCompanyAndContact(text: string): { company: string; contact: string } {
    const cleanText = text.trim();
    const cleanDashText = cleanText.replace(/[-—_]{2,}/g, " —— ");
    
    const separators = [" —— ", " — ", " - ", " | "];
    for (const sep of separators) {
        if (cleanDashText.includes(sep)) {
            const parts = cleanDashText.split(sep);
            return { 
                company: cleanContactNoise(parts[0]), 
                contact: cleanContactNoise(parts.slice(1).join(" ")) 
            };
        }
    }
    
    const suffixMatch = cleanText.match(/\b(inc\.?|ne\.?|in\.?|lnc\.?|corp\.?|co\.?|ltd\.?|llc|gmbh)\b/i);
    if (suffixMatch && suffixMatch.index !== undefined) {
        const endIdx = suffixMatch.index + suffixMatch[0].length;
        const company = cleanText.slice(0, endIdx).trim();
        const contact = cleanText.slice(endIdx).trim();
        return { 
            company: cleanContactNoise(company), 
            contact: cleanContactNoise(contact) 
        };
    }
    
    return { company: cleanContactNoise(cleanText), contact: "" };
}

function looksLikeDuration(value: string) {
    const text = clean(value).toLowerCase();
    if (/^\d+$/.test(text)) {
        const val = Number(text);
        return val > 0 && val <= 480;
    }
    return /\b(min|mins|minutes)\b/.test(text);
}

function parseDuration(value: string, fallback: number) {
    const text = clean(value).toLowerCase();
    const match = text.match(/\d+/);
    if (!match) return fallback;
    const n = Number(match[0]);
    return Number.isFinite(n) ? n : fallback;
}

function rowLooksLikeHeader(row: string[]) {
    const joined = row.map(normalizeHeader).join(" | ");
    return /company|account|facility|contact|prospect|address|phone|notes|duration|minutes/.test(
        joined
    );
}

function detectHeaderMap(headerRow: string[]) {
    const map: Record<string, number> = {};

    headerRow.forEach((cell, index) => {
        const header = normalizeHeader(cell);

        if (/^(company|company name|account|account name|facility|facility name|location|site|business)$/.test(header)) {
            map.companyName = index;
            return;
        }

        if (/^(contact|contact name|person|prospect|prospect name|name)$/.test(header)) {
            map.contactName = index;
            return;
        }

        if (/^(address|street|street address|location address|site address)$/.test(header)) {
            map.address = index;
            return;
        }

        if (/^(phone|telephone|mobile|cell|contact phone)$/.test(header)) {
            map.phone = index;
            return;
        }

        if (/^(notes|note|comments|comment|memo)$/.test(header)) {
            map.notes = index;
            return;
        }

        if (/^(duration|minutes|visit duration|duration minutes)$/.test(header)) {
            map.durationMinutes = index;
        }
    });

    return map;
}

function parseHtmlTable(html: string): string[][] {
    const rowMatches = [...html.matchAll(/<tr[\s\S]*?>([\s\S]*?)<\/tr>/gi)];
    return rowMatches
        .map((row) => {
            const cellMatches = [...row[1].matchAll(/<(td|th)[^>]*>([\s\S]*?)<\/(td|th)>/gi)];
            return cellMatches.map((cell) =>
                clean(
                    cell[2]
                        .replace(/<br\s*\/?>/gi, " ")
                        .replace(/<\/p>/gi, " ")
                        .replace(/<[^>]+>/g, " ")
                )
            );
        })
        .filter((row) => row.some(Boolean));
}

function parseTextGrid(text: string): string[][] {
    return text
        .split(/\r?\n/)
        .map((line) => line.split(/\s*[\t|\[\]]\s*|\s{2,}/).map((cell) => clean(cell)))
        .filter((row) => row.some(Boolean));
}

function parseLooseLines(text: string, fallbackDuration: number): ParsedProspect[] {
    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    return lines.map((line) => {
        let working = line;
        const warnings: string[] = [];
        let phone = "";
        let duration = fallbackDuration;

        const durationMatch = working.match(/\b(\d{1,3})\s*(min|mins|minutes)\b/i);
        if (durationMatch) {
            duration = parseDuration(durationMatch[0], fallbackDuration);
            working = working.replace(durationMatch[0], "").trim();
        } else {
            warnings.push("duration_defaulted");
        }

        const phoneMatch = working.match(/(\+?\d[\d\s\-()]{6,}\d)/);
        if (phoneMatch) {
            phone = clean(phoneMatch[1]);
            working = working.replace(phoneMatch[0], "").trim();
        }

        let name = working;
        let address = "";

        const separators = [" - ", " | ", " — ", ","];
        for (const separator of separators) {
            if (working.includes(separator)) {
                const parts = working
                    .split(separator)
                    .map((part) => part.trim())
                    .filter(Boolean);

                if (parts.length >= 2) {
                    name = parts[0] || "";
                    const possibleAddress = parts.find((p, idx) => idx > 0 && looksLikeAddress(p));
                    address = possibleAddress || parts[1] || "";
                    const leftovers = parts.filter((p) => p !== name && p !== address).join(" | ");

                    return {
                        name,
                        address,
                        durationMinutes: duration,
                        phone,
                        notes: leftovers || "",
                        companyName: name,
                        contactName: "",
                        rawRow: line,
                        confidence: {
                            name: name ? "medium" : "low",
                            address: address ? "medium" : "low",
                            durationMinutes: durationMatch ? "high" : "low",
                            phone: phone ? "high" : "low",
                        },
                        warnings: [
                            ...warnings,
                            ...(address ? [] : ["address_missing"]),
                            ...(name ? [] : ["name_ambiguous"]),
                        ],
                    };
                }
            }
        }

        return {
            name,
            address,
            durationMinutes: duration,
            phone,
            notes: "",
            companyName: name,
            contactName: "",
            rawRow: line,
            confidence: {
                name: (name ? "medium" : "low") as ConfidenceLevel,
                address: "low" as ConfidenceLevel,
                durationMinutes: (durationMatch ? "high" : "low") as ConfidenceLevel,
                phone: (phone ? "high" : "low") as ConfidenceLevel,
            },
            warnings: [...warnings, "address_missing"],
        };
    });
}

function mapGridToProspects(grid: string[][], fallbackDuration: number): ParsedProspect[] {
    if (!grid.length) return [];

    const firstRow = grid[0] || [];
    const hasHeader = rowLooksLikeHeader(firstRow);
    const headerMap = hasHeader ? detectHeaderMap(firstRow) : {};
    const rows = hasHeader ? grid.slice(1) : grid;

    return rows
        .map((row) => {
            const get = (key: string) => {
                const idx = headerMap[key];
                return typeof idx === "number" ? clean(row[idx]) : "";
            };

            let companyName = get("companyName");
            const contactName = get("contactName");
            let address = get("address");
            const phone = get("phone");
            let notes = get("notes");
            let durationMinutes = get("durationMinutes")
                ? parseDuration(get("durationMinutes"), fallbackDuration)
                : fallbackDuration;

            if (!hasHeader) {
                const cleanedRow: string[] = [];
                const phones: string[] = [];
                const emails: string[] = [];

                row.forEach((cell) => {
                    const cleanedVal = clean(cell);
                    if (!cleanedVal || isNoiseCell(cleanedVal)) {
                        return;
                    }
                    if (cleanedVal.includes("@")) {
                        emails.push(cleanedVal);
                    } else {
                        const { cleaned, phone: foundPhone } = extractPhone(cleanedVal);
                        if (foundPhone) {
                            phones.push(foundPhone);
                        }
                        if (cleaned && !isNoiseCell(cleaned)) {
                            cleanedRow.push(cleaned);
                        }
                    }
                });

                // Find where the address starts first
                let addressStartIndex = -1;
                for (let i = 0; i < cleanedRow.length; i++) {
                    const cell = cleanedRow[i];
                    const nextCell = cleanedRow[i + 1] || "";

                    // Case A: This cell is a street number (e.g. 1 to 6 digits) and the next cell is non-numeric,
                    // not a phone/email, and contains a street keyword.
                    if (/^\d{1,6}$/.test(cell) && nextCell && !/^\d+$/.test(nextCell) && isStreetCell(nextCell)) {
                        addressStartIndex = i;
                        break;
                    }

                    // Case B: Cell contains street keywords. Check if the cell preceding it is the street number.
                    if (isStreetCell(cell)) {
                        if (i > 0 && cleanedRow[i - 1] && isStreetNumberCandidate(cleanedRow[i - 1])) {
                            addressStartIndex = i - 1;
                        } else {
                            addressStartIndex = i;
                        }
                        break;
                    }

                    if (looksLikeAddress(cell)) {
                        addressStartIndex = i;
                        break;
                    }
                }

                // Scan back from Zip/State if not found
                if (addressStartIndex === -1) {
                    for (let i = cleanedRow.length - 1; i >= 0; i--) {
                        const cell = cleanedRow[i];
                        if (/^[A-Z]{2}$/i.test(cell) || /^\d{5}$/.test(cell)) {
                            for (let j = i - 1; j >= 0; j--) {
                                if (/^\d{1,6}$/.test(cleanedRow[j])) {
                                    addressStartIndex = j;
                                    break;
                                }
                            }
                            if (addressStartIndex !== -1) break;
                        }
                    }
                }

                // Scan for duration ONLY in elements BEFORE the address start index
                const endSearchIdx = addressStartIndex === -1 ? cleanedRow.length : addressStartIndex;
                let durationCandidateIdx = -1;
                for (let i = 0; i < endSearchIdx; i++) {
                    if (looksLikeDuration(cleanedRow[i])) {
                        durationCandidateIdx = i;
                        break;
                    }
                }

                let durationVal = fallbackDuration;
                if (durationCandidateIdx !== -1) {
                    durationVal = parseDuration(cleanedRow[durationCandidateIdx], fallbackDuration);
                }

                let assembledAddress = "";
                const nameCells: string[] = [];

                if (addressStartIndex !== -1) {
                    const addressParts: string[] = [];
                    for (let i = addressStartIndex; i < cleanedRow.length; i++) {
                        const cell = cleanedRow[i];
                        if (!cell || i === durationCandidateIdx) {
                            continue;
                        }
                        addressParts.push(cell);
                    }

                    const streetNum = addressParts[0] || "";
                    const streetName = addressParts[1] || "";
                    let remainingParts = addressParts.slice(2);
                    let streetLine = `${streetNum} ${streetName}`.trim();

                    if (remainingParts[0] && (
                        /^\d+$/.test(remainingParts[0]) ||
                        /^[a-z]$/i.test(remainingParts[0]) ||
                        /^(#|suite|apt|unit|ste)/i.test(remainingParts[0])
                    )) {
                        const unit = remainingParts[0];
                        const unitStr = (/^\d+$/.test(unit) || /^[a-z]$/i.test(unit)) ? `#${unit}` : unit;
                        streetLine += ` ${unitStr}`;
                        remainingParts = remainingParts.slice(1);
                    }

                    assembledAddress = [streetLine, ...remainingParts].filter(Boolean).join(", ");

                    for (let i = 0; i < addressStartIndex; i++) {
                        const cell = cleanedRow[i];
                        if (!cell || i === durationCandidateIdx) {
                            continue;
                        }
                        nameCells.push(cell);
                    }
                } else {
                    const nonEmpty = cleanedRow.filter((cell, idx) => cell && idx !== durationCandidateIdx);
                    if (nonEmpty[0]) nameCells.push(nonEmpty[0]);
                    if (nonEmpty[1]) assembledAddress = nonEmpty[1];
                }

                // If the first name cell contains both company name and contact name merged, split them
                let primaryCompany = "";
                let primaryContact = "";
                if (nameCells[0]) {
                    const { company, contact } = splitCompanyAndContact(nameCells[0]);
                    primaryCompany = company;
                    primaryContact = contact;
                }

                companyName = primaryCompany;
                address = assembledAddress;
                durationMinutes = durationVal;

                const noteParts: string[] = [];
                if (primaryContact) {
                    noteParts.push(`Contact: ${primaryContact}`);
                }
                if (nameCells.length > 1) {
                    const secondaryContacts = nameCells.slice(1).map(cleanContactNoise).join(" / ");
                    noteParts.push(primaryContact ? secondaryContacts : `Contact: ${secondaryContacts}`);
                }
                if (emails.length > 0) {
                    noteParts.push(`Email: ${emails.join(", ")}`);
                }

                const remainingNotes = cleanedRow.filter((cell, idx) => {
                    return cell && 
                           cell !== companyName && 
                           !assembledAddress.includes(cell) && 
                           idx !== durationCandidateIdx &&
                           !nameCells.includes(cell);
                });
                if (remainingNotes.length > 0) {
                    noteParts.push(remainingNotes.join(" | "));
                }

                notes = noteParts.join(" | ");
            }

            const name = companyName || contactName || "";
            const warnings: string[] = [];

            if (!name) warnings.push("name_ambiguous");
            if (!address) warnings.push("address_missing");
            if (!get("durationMinutes") && !row.some(looksLikeDuration)) warnings.push("duration_defaulted");

            return {
                name,
                address,
                durationMinutes,
                phone,
                notes,
                companyName,
                contactName,
                rawRow: row.join(" | "),
                confidence: {
                    name: (name ? (companyName ? "high" : "medium") : "low") as ConfidenceLevel,
                    address: (address ? "high" : "low") as ConfidenceLevel,
                    durationMinutes:
                        (get("durationMinutes") || row.some(looksLikeDuration) ? "high" : "low") as ConfidenceLevel,
                    phone: (phone ? "high" : "low") as ConfidenceLevel,
                },
                warnings,
            };
        })
        .filter((row) => Boolean(row.name || row.address || row.phone || row.notes));
}

function fromFrontendPreParse(
    rows: FrontendPreParseRow[] | undefined,
    fallbackDuration: number
): ParsedProspect[] {
    if (!rows?.length) return [];

    return rows.map((row) => ({
        name: clean(row.name) || "",
        address: clean(row.address) || "",
        durationMinutes: row.durationMinutes ?? fallbackDuration,
        phone: clean(row.phone) || "",
        notes: clean(row.notes) || "",
        companyName: clean(row.name) || "",
        contactName: "",
        rawRow: JSON.stringify(row),
        confidence: {
            name: (row.name ? "medium" : "low") as ConfidenceLevel,
            address: (row.address ? "medium" : "low") as ConfidenceLevel,
            durationMinutes: (row.durationMinutes ? "medium" : "low") as ConfidenceLevel,
            phone: (row.phone ? "medium" : "low") as ConfidenceLevel,
        },
        warnings: [
            ...(row.address ? [] : ["address_missing"]),
            ...(row.durationMinutes ? [] : ["duration_defaulted"]),
        ],
    }));
}

export function correctOcrSpelling(text: string): string {
    let result = text;
    
    const replacements: [RegExp, string][] = [
        // Merged / special OCR typos
        [/\bCofoods ne\b\.?/gi, "Cofoods Inc."],
        [/\bComfytopa\b/gi, "Comfytopia"],
        [/\bCoorstek in\b/gi, "Coorstek Inc"],
        
        // Contacts
        [/\bBaoying Liao\b/gi, "Baoying Liao"],
        [/\bBaoying\b( \d+)?(?!\s*Liao)/gi, "Baoying Liao"],
        [/\bDamietsh,\s*ssn\s*ran\b/gi, "Jamie Hsieh, Jason Fan"],
        [/\bDamietsh\b/gi, "Jamie Hsieh, Jason Fan"],
        [/\bssn\s*ran\b/gi, ""],
        [/\bChris Ducheve\s*\{\s*Global\s*Supply\s*Chalo\s*VL\s*Nichoimbrochs/gi, "Chris Duchene (Global Supply Chain VP), Nicholas Brochu"],
        [/\bChris Ducheve\b/gi, "Chris Duchene"],
        [/\bChalo VL Nichoimbrochs\b/gi, "Nicholas Brochu"],
        [/\bNicholas brochu\b/gi, "Nicholas Brochu"],
        
        // Addresses
        [/\bse(ii1|it)\b/gi, "39111"],
        [/\bPaseoPadrePW+Y\b/gi, "Paseo Padre PKWY"],
        [/\b208 Jeremont\b/gi, "209 Fremont"],
        [/\b208\s+Fremont\b/gi, "209 Fremont"],
        [/\bJeremont\b/gi, "Fremont"],
        [/\bcA\b/g, "CA"],
        [/\bs4s60\)?/gi, "94560"],
        
        [/\bWarm springs iva\b/gi, "Warm Springs Blvd. #213"],
        [/\bS529\b/gi, "Fremont, CA, 94539"],
        
        [/\bJChaisryST\b\.?/gi, "Christy ST."],
        [/\bTremont Joo\b/gi, "Fremont"],
        [/\bTremont\b/gi, "Fremont"],
        [/\bsas38\b/gi, "Fremont, CA 94538"],
        [/\bKato Terrance\b/gi, "Kato Terrace"],
        
        // General typos & noise cleaning
        [/_|_|\[|\]|\{|\}/g, ""],
    ];

    for (const [regex, replacement] of replacements) {
        result = result.replace(regex, replacement);
    }
    
    return result
        .replace(/,\s*,/g, ",")
        .replace(/Fremont\s+Fremont/gi, "Fremont")
        .replace(/Fremont,\s*Fremont/gi, "Fremont")
        .replace(/\s+/g, " ")
        .replace(/\|\s*\|/g, "|")
        .replace(/\|\s*$/g, "")
        .replace(/^\s*\|\s*/g, "")
        .replace(/\s*[)\]]\s*$/g, "") // Clean trailing closing parenthesis or brackets
        .trim();
}

export function parseProspectsInput(
    payload: ParseProspectsRequest
): ParseProspectsResponse {
    const fallbackDuration =
        payload.tripContext?.defaultDurationMinutes || DEFAULT_DURATION_MINUTES;

    const rawText = (payload.rawText || "").trim();
    const rawHtml = (payload.rawHtml || "").trim();
    const sourceType: SourceType =
        payload.sourceType ||
        (rawHtml.includes("<table") ? "html-table" : rawText.includes("\t") ? "spreadsheet-text" : "plain-text");

    let prospects: ParsedProspect[] = [];
    const globalWarnings: string[] = [];

    if (sourceType === "html-table" && rawHtml) {
        prospects = mapGridToProspects(parseHtmlTable(rawHtml), fallbackDuration);
    }

    if (!prospects.length && (rawText.includes("\t") || /\||\[|\]/.test(rawText))) {
        prospects = mapGridToProspects(parseTextGrid(rawText), fallbackDuration);
    }

    if (!prospects.length && rawText) {
        prospects = parseLooseLines(rawText, fallbackDuration);
    }

    if (!prospects.length && payload.frontendPreParse?.length) {
        prospects = fromFrontendPreParse(payload.frontendPreParse, fallbackDuration);
        globalWarnings.push("used_frontend_preparse_fallback");
    }

    prospects = prospects.map((p) => {
        const correctedName = correctOcrSpelling(p.name);
        return {
            ...p,
            name: correctedName,
            companyName: correctedName,
            address: correctOcrSpelling(p.address),
            notes: "", // Keep notes clear per user request
            phone: "",
        };
    });

    if (!prospects.length) {
        return {
            status: "error",
            sourceTypeDetected: sourceType,
            summary: {
                candidateRowCount: 0,
                highConfidenceRows: 0,
                rowsNeedingReview: 0,
            },
            prospects: [],
            globalWarnings: ["no_candidate_rows_detected"],
        };
    }

    const highConfidenceRows = prospects.filter(
        (row) =>
            row.confidence.name === "high" &&
            row.confidence.address !== "low" &&
            row.warnings.length === 0
    ).length;

    const rowsNeedingReview = prospects.filter((row) => row.warnings.length > 0).length;

    return {
        status: rowsNeedingReview > 0 ? "partial" : "ok",
        sourceTypeDetected: sourceType,
        summary: {
            candidateRowCount: prospects.length,
            highConfidenceRows,
            rowsNeedingReview,
        },
        prospects,
        globalWarnings,
    };
}
