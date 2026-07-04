export type SourceType =
    | "plain-text"
    | "html-table"
    | "spreadsheet-text"
    | "screenshot-ocr"
    | "unknown";

export type ConfidenceLevel = "high" | "medium" | "low";

export type FrontendPreParseRow = {
    name?: string;
    address?: string;
    durationMinutes?: number | null;
    phone?: string;
    notes?: string;
};

export type ParseProspectsRequest = {
    sourceType?: SourceType;
    rawText?: string;
    rawHtml?: string | null;
    imageRef?: string | null;
    tripContext?: {
        defaultDurationMinutes?: number;
        locale?: string;
    };
    frontendPreParse?: FrontendPreParseRow[];
};

export type ParsedProspect = {
    name: string;
    address: string;
    durationMinutes: number | null;
    phone?: string;
    notes?: string;
    companyName?: string;
    contactName?: string;
    rawRow: string;
    confidence: {
        name: ConfidenceLevel;
        address: ConfidenceLevel;
        durationMinutes: ConfidenceLevel;
        phone: ConfidenceLevel;
    };
    warnings: string[];
};

export type ParseProspectsResponse = {
    status: "ok" | "partial" | "error";
    sourceTypeDetected: SourceType;
    summary: {
        candidateRowCount: number;
        highConfidenceRows: number;
        rowsNeedingReview: number;
    };
    prospects: ParsedProspect[];
    globalWarnings: string[];
};
