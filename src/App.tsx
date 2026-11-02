import React, { useState, useEffect, useRef } from "react";
import {
  Check,
  Copy,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Upload,
  Plus,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Settings,
  Users,
  BarChart,
  Download,
  ExternalLink,
  Save,
  Eye,
  AlertTriangle,
  X,
  Pencil,
  Shield,
  Rocket,
  Clock,
  Lock,
  Square,
  Database,
  Play,
  Pause,
  Trophy,
  FileImage,
  Printer,
  Briefcase,
  ShieldCheck,
} from "lucide-react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
} from "firebase/firestore";

import QRCode from "qrcode";
import { jsPDF } from "jspdf";

// ============================================================================
// 🔥 FIREBASE CONFIGURATION 🔥
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyBTEFgp5cpAOHmAVEDF5WuciOkgdTaxkAg",
  authDomain: "trial-77443.firebaseapp.com",
  projectId: "trial-77443",
  storageBucket: "trial-77443.firebasestorage.app",
  messagingSenderId: "699078824780",
  appId: "1:699078824780:web:c4b02bda3c333c7a9ab5e9",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// ============================================================================

interface PositionConfig {
  id: string;
  title: string;
  maxSelections: number;
  description?: string;
}

interface Candidate {
  id: string;
  name: string;
  title?: string;
  positionId?: string;
  imageUrl?: string;
  infoUrl?: string;
  avatarBg: string;
}

interface VoterRecord {
  id: string;
  voterName: string;
  email: string;
  token: string;
  hasVoted: boolean;
  votedAt?: string;
  receiptCode?: string;
}

interface ElectionConfig {
  id: string;
  orgName: string;
  electionTitle: string;
  subsectorName: string;
  loginSubtitle: string;
  acknowledgmentText: string;
  thankYouMessage: string;
  instructionsText: string;
  isSecretBallot: boolean;
  isLaunched: boolean;
  isPaused: boolean;
  isHardEnded: boolean;
  sealResults: boolean;
  startTime: string;
  endTime: string;
  createdAt: string;
  scrutineerPassword?: string;
}

interface VoteRecord {
  receiptCode: string;
  timestamp: string;
  selectedCandidateIds: string[];
  selectedCandidateNames?: string[];
  voterToken?: string;
  isVoided?: boolean;
}

interface ElectionData {
  config: ElectionConfig;
  positions: PositionConfig[];
  candidates: Candidate[];
  voters: VoterRecord[];
  votes: VoteRecord[];
}

const HKGBCLogo = ({ height = 32 }: { height?: number }) => (
  <img
    src="/HKGBC Logo.jpg"
    alt="HKGBC Logo"
    style={{ height: `${height}px`, width: "auto", objectFit: "contain" }}
    className="shrink-0"
    onError={(e) => {
      (e.target as HTMLImageElement).src =
        "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/HKGBC_Logo.svg/512px-HKGBC_Logo.svg.png";
    }}
  />
);

const createNewElection = (): ElectionData => ({
  config: {
    id: "elec_" + Date.now(),
    orgName: "HKGBC",
    electionTitle: "New Election Title (Edit me)",
    subsectorName: "Subsector Name",
    loginSubtitle: "Sign in to access your ballot",
    acknowledgmentText:
      "I hereby confirm my identity as a Director of the HKGBC and acknowledge that this electronic submission is single-use, final, and irrevocable.",
    thankYouMessage:
      "Your ballot has been successfully submitted. Thank you for your participation!",
    instructionsText:
      "Please select your preferred candidates for each position",
    isSecretBallot: true,
    isLaunched: false,
    isPaused: false,
    isHardEnded: false,
    sealResults: false,
    startTime: "",
    endTime: "",
    createdAt: new Date().toLocaleDateString(),
    scrutineerPassword: "",
  },
  positions: [],
  candidates: [],
  voters: [],
  votes: [],
});

const parseLocalTime = (timeString: string) => {
  if (!timeString) return null;
  try {
    const [datePart, timePart] = timeString.split("T");
    if (!datePart || !timePart) return null;
    const [year, month, day] = datePart.split("-").map(Number);
    const [hours, minutes] = timePart.split(":").map(Number);
    return new Date(year, month - 1, day, hours, minutes).getTime();
  } catch {
    return null;
  }
};

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result.map((s) => s.trim());
};

export default function App() {
  const [dbState, setDbState] = useState<ElectionData[]>([]);
  const [isDbLoading, setIsDbLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "elections"),
      (snapshot) => {
        const elections: ElectionData[] = [];
        snapshot.forEach((docSnap) =>
          elections.push(docSnap.data() as ElectionData)
        );
        setDbState(elections);
        setIsDbLoading(false);
      },
      (error) => {
        console.error("Firestore error:", error);
        setIsDbLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const saveToFirestore = async (updatedData: ElectionData) => {
    try {
      const cleanData = JSON.parse(
        JSON.stringify(updatedData, (key, value) =>
          value === undefined ? "" : value
        )
      );
      await setDoc(doc(db, "elections", cleanData.config.id), cleanData);
    } catch (err: any) {
      console.error(err);
      alert("Firebase Error: " + err.message);
    }
  };

  const deleteFromFirestore = async (id: string) => {
    try {
      await deleteDoc(doc(db, "elections", id));
    } catch (err) {
      console.error(err);
    }
  };

  const queryParams = new URLSearchParams(window.location.search);
  const urlToken = queryParams.get("token")?.toUpperCase();
  const urlElectionId = queryParams.get("election");
  const isAdminBypass = queryParams.get("admin") === "HKGBC_adminportal1";
  const isScrutineerBypass = queryParams.get("scrutineer") === "true";
  const verifyCode = queryParams.get("verify")?.trim();

  const [viewMode, setViewMode] = useState<"admin" | "voter" | "scrutineer">(
    urlToken
      ? "voter"
      : isAdminBypass
      ? "admin"
      : isScrutineerBypass
      ? "scrutineer"
      : "voter"
  );

  const [isAdminAuth, setIsAdminAuth] = useState(isAdminBypass);
  const [adminPassInput, setAdminPassInput] = useState("");
  const [adminError, setAdminError] = useState("");

  const [activeElectionId, setActiveElectionId] = useState<string | null>(
    isScrutineerBypass ? urlElectionId || null : null
  );
  const [adminTab, setAdminTab] = useState<
    "results" | "voters" | "candidates" | "settings"
  >("results");

  const [isScrutineerAuth, setIsScrutineerAuth] = useState(false);
  const [scrutineerPassInput, setScrutineerPassInput] = useState("");
  const [scrutineerError, setScrutineerError] = useState("");

  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(
    null
  );
  const [candName, setCandName] = useState("");
  const [candTitle, setCandTitle] = useState("");
  const [candPositionId, setCandPositionId] = useState("");
  const [candImage, setCandImage] = useState<string | undefined>(undefined);
  const [candInfoUrl, setCandInfoUrl] = useState("");

  const [voterName, setVoterName] = useState("");
  const [voterEmail, setVoterEmail] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [voterSearch, setVoterSearch] = useState("");
  const [voterFilter, setVoterFilter] = useState<"all" | "voted" | "pending">(
    "all"
  );
  const [voterPage, setVoterPage] = useState(1);
  const votersPerPage = 50;

  const [selectedVoters, setSelectedVoters] = useState<string[]>([]);

  const csvInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isAddingVoter, setIsAddingVoter] = useState(false);

  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isSavingCandidate, setIsSavingCandidate] = useState(false);

  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);

  const [editConfig, setEditConfig] = useState<ElectionConfig | null>(null);
  const [editPositions, setEditPositions] = useState<PositionConfig[]>([]);
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    isDanger: boolean;
    requireText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "",
    isDanger: false,
    requireText: undefined,
    onConfirm: () => {},
  });
  const [modalInputText, setModalInputText] = useState("");

  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [backupSelection, setBackupSelection] = useState<string[]>([]);

  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [previewStep, setPreviewStep] = useState(2);
  const [previewAcknowledged, setPreviewAcknowledged] = useState(false);
  const [previewSelectedIds, setPreviewSelectedIds] = useState<string[]>([]);

  const [voterStep, setVoterStep] = useState<number>(1);
  const [voterKeyInput, setVoterKeyInput] = useState<string>(urlToken || "");
  const [voterError, setVoterError] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [receiptId, setReceiptId] = useState("");
  const [receiptTime, setReceiptTime] = useState("");
  const [receiptSelections, setReceiptSelections] = useState<string[]>([]);

  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const activeData = dbState.find((d) => d.config.id === activeElectionId);
  const votingData = urlElectionId
    ? dbState.find((d) => d.config.id === urlElectionId)
    : dbState.find((d) =>
        d.voters.some((v) => v.token.toUpperCase() === urlToken)
      );
  const currentVoter = votingData?.voters.find(
    (v) => v.token.toUpperCase() === urlToken
  );

  const verifyResult = (() => {
    if (!verifyCode) return null;
    const code = verifyCode.toLowerCase();
    for (const el of dbState) {
      const vote = el.votes.find((v) => v.receiptCode.toLowerCase() === code);
      if (vote) {
        const voter = el.voters.find(
          (v) =>
            v.receiptCode?.toLowerCase() === code ||
            (vote.voterToken && v.token === vote.voterToken)
        );
        return { election: el, vote, voter };
      }
    }
    return null;
  })();

  let voterStatus:
    | "unlaunched"
    | "paused"
    | "early"
    | "closed"
    | "open"
    | "voted"
    | "invalid" = "open";
  if (votingData) {
    const { isLaunched, isPaused, isHardEnded, startTime, endTime } =
      votingData.config;
    const now = currentTime.getTime();

    if (urlToken && !currentVoter) {
      voterStatus = "invalid";
    } else if (currentVoter?.hasVoted && voterStep !== 5) {
      voterStatus = "voted";
      if (voterStep !== 1) {
        setVoterStep(1);
        setVoterError("You have already voted.");
      }
    } else if (isHardEnded || !isLaunched) {
      voterStatus = "closed";
    } else if (isPaused) {
      voterStatus = "paused";
    } else {
      const startMs = parseLocalTime(startTime);
      const endMs = parseLocalTime(endTime);
      if (startMs && now < startMs) voterStatus = "early";
      else if (endMs && now > endMs) voterStatus = "closed";
    }
  } else if (dbState.length > 0 && !isDbLoading) {
    voterStatus = "invalid";
  }

  useEffect(() => {
    if (adminTab === "settings" && activeData) {
      setEditConfig({ ...activeData.config });
      setEditPositions(activeData.positions || []);
    }
  }, [adminTab, activeElectionId, activeData]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 300;
          const MAX_HEIGHT = 300;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
            setCandImage(compressedBase64);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !activeData) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = (event.target?.result as string) || "";
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        if (lines.length === 0) return alert("CSV file is empty.");

        const firstLower = lines[0].toLowerCase().replace(/\s/g, "");
        const emailFirst =
          firstLower === "email,name" || firstLower === "email";
        const hasHeader =
          firstLower === "name,email" ||
          firstLower === "email,name" ||
          firstLower === "email";
        const startIdx = hasHeader ? 1 : 0;

        const existingEmails = new Set(
          activeData.voters
            .map((v) => (v.email || "").toLowerCase().trim())
            .filter(Boolean)
        );

        const newVoters: VoterRecord[] = [];
        let skipped = 0;

        for (let i = startIdx; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          const name = (emailFirst ? cols[1] : cols[0]) || "";
          const email = (emailFirst ? cols[0] : cols[1]) || "";

          if (!name) {
            skipped++;
            continue;
          }
          const emailKey = email.toLowerCase().trim();
          if (emailKey && existingEmails.has(emailKey)) {
            skipped++;
            continue;
          }
          if (emailKey) existingEmails.add(emailKey);

          const token =
            "HKGBC-" +
            Math.random().toString(36).substring(2, 6).toUpperCase() +
            "-" +
            Math.floor(100 + Math.random() * 900);
          newVoters.push({
            id: "v" + Date.now() + "_" + i,
            voterName: name,
            email: email,
            token,
            hasVoted: false,
          });
        }

        if (newVoters.length === 0) {
          return alert(
            `No new voters were imported.${
              skipped > 0
                ? `\n\nSkipped ${skipped} row(s) due to duplicates or missing names.`
                : ""
            }`
          );
        }

        setIsImporting(true);
        await saveToFirestore({
          ...activeData,
          voters: [...activeData.voters, ...newVoters],
        });
        setIsImporting(false);

        let msg = `Successfully imported ${newVoters.length} voter(s).`;
        if (skipped > 0)
          msg += `\nSkipped ${skipped} row(s) (duplicates or missing names).`;

        alert(msg);
      } catch (err: any) {
        setIsImporting(false);
        console.error(err);
        alert("Error reading CSV: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleCandidateCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !activeData) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = (event.target?.result as string) || "";
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        if (lines.length === 0) return alert("CSV file is empty.");

        const firstLower = lines[0].toLowerCase().replace(/\s/g, "");
        const hasHeader =
          firstLower.includes("name") || firstLower.includes("position");
        const startIdx = hasHeader ? 1 : 0;

        const newCandidates: Candidate[] = [];
        let skipped = 0;
        let errors: string[] = [];

        for (let i = startIdx; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);

          const positionName = cols[0] || "";
          const name = cols[1] || "";
          const title = cols[2] || "";
          const infoUrl = cols[3] || "";

          if (!name) {
            skipped++;
            continue;
          }

          const matchedPos = activeData.positions?.find(
            (p) =>
              p.title.toLowerCase().trim() === positionName.toLowerCase().trim()
          );

          if (!matchedPos) {
            errors.push(
              `Row ${
                i + 1
              }: Position "${positionName}" does not match any existing position.`
            );
            skipped++;
            continue;
          }

          newCandidates.push({
            id: "c" + Date.now() + "_" + i,
            name: name,
            title: title,
            positionId: matchedPos.id,
            avatarBg: "#E2E8F0",
            infoUrl: infoUrl,
            imageUrl: "",
          });
        }

        if (newCandidates.length === 0) {
          return alert(
            `No candidates were imported.${
              errors.length > 0 ? "\n\nErrors:\n" + errors.join("\n") : ""
            }`
          );
        }

        setIsImporting(true);
        await saveToFirestore({
          ...activeData,
          candidates: [...activeData.candidates, ...newCandidates],
        });
        setIsImporting(false);

        let msg = `Successfully imported ${newCandidates.length} candidate(s).`;
        if (skipped > 0) msg += `\nSkipped ${skipped} row(s).`;
        if (errors.length > 0) msg += `\n\nIssues found:\n` + errors.join("\n");

        alert(msg);
      } catch (err: any) {
        setIsImporting(false);
        console.error(err);
        alert("Error reading CSV: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const filteredVoters = (activeData?.voters || []).filter((v) => {
    const q = voterSearch.toLowerCase().trim();
    const matchesSearch =
      !q ||
      v.voterName.toLowerCase().includes(q) ||
      (v.email || "").toLowerCase().includes(q) ||
      v.token.toLowerCase().includes(q) ||
      (v.receiptCode || "").toLowerCase().includes(q);
    const matchesFilter =
      voterFilter === "all"
        ? true
        : voterFilter === "voted"
        ? v.hasVoted
        : !v.hasVoted;
    return matchesSearch && matchesFilter;
  });

  const totalPages = Math.ceil(filteredVoters.length / votersPerPage);
  const paginatedVoters = filteredVoters.slice(
    (voterPage - 1) * votersPerPage,
    voterPage * votersPerPage
  );

  const safeCopyText = (text: string, id: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
    } catch (err) {}
    document.body.removeChild(textArea);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const makeReceiptHash = (
    code: string,
    candidateIds: string[],
    timestamp: string
  ) => {
    const input = `${code}|${[...candidateIds].sort().join(",")}|${timestamp}`;
    let h = 0;
    for (let i = 0; i < input.length; i++) {
      h = (h << 5) - h + input.charCodeAt(i);
      h |= 0;
    }
    return "h" + Math.abs(h).toString(16).padStart(8, "0");
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassInput === "admin123") {
      setIsAdminAuth(true);
      setAdminError("");
    } else setAdminError("Invalid admin password.");
  };

  const handleScrutineerLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeData || !activeData.config.scrutineerPassword) {
      setScrutineerError("No scrutineer password set for this election.");
      return;
    }
    if (scrutineerPassInput === activeData.config.scrutineerPassword) {
      setIsScrutineerAuth(true);
      setScrutineerError("");
    } else {
      setScrutineerError("Invalid scrutineer password.");
    }
  };

  const handleVoterLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!votingData) return setVoterError("Invalid election link.");
    const cleanKey = voterKeyInput.trim().toUpperCase();
    const match = votingData.voters.find(
      (v) => v.token.toUpperCase() === cleanKey
    );
    if (!match) return setVoterError("Invalid voter key.");
    if (match.hasVoted) return setVoterError("This key has already been used.");
    setVoterError("");
    setVoterStep(1);
  };

  const handleAcknowledge = () => {
    if (!acknowledged)
      return setVoterError("Please acknowledge the rules first.");
    setVoterError("");
    setVoterStep(2);
  };

  const toggleCandidateSelection = (
    candidateId: string,
    positionId: string,
    isPreview: boolean = false
  ) => {
    const currentSelected = isPreview ? previewSelectedIds : selectedIds;
    const setSelected = isPreview ? setPreviewSelectedIds : setSelectedIds;
    const currentData = isPreview ? activeData : votingData;

    const position = currentData?.positions.find((p) => p.id === positionId);
    if (!position) return;

    const currentSelectedForPos = currentSelected.filter((id) => {
      const cand = currentData.candidates.find((c) => c.id === id);
      return cand?.positionId === positionId;
    });

    if (currentSelected.includes(candidateId)) {
      setSelected(currentSelected.filter((c) => c !== candidateId));
    } else {
      if (currentSelectedForPos.length < position.maxSelections) {
        setSelected([...currentSelected, candidateId]);
      } else {
        alert(
          `You can only select up to ${position.maxSelections} candidate(s) for ${position.title}.`
        );
      }
    }
  };

  const handleBallotSubmit = async () => {
    if (!votingData || isSubmittingVote) return;
    setIsSubmittingVote(true);
    setIsSubmitConfirmOpen(false);

    try {
      const currentConfig = votingData.config;
      const now = Date.now();
      const endMs = parseLocalTime(currentConfig.endTime);

      if (
        currentConfig.isHardEnded ||
        !currentConfig.isLaunched ||
        currentConfig.isPaused
      ) {
        alert("This election is no longer accepting votes.");
        return;
      }
      if (endMs && now > endMs) {
        alert("Voting has closed.");
        return;
      }

      const voterToUpdate = votingData.voters.find(
        (v) => v.token.toUpperCase() === urlToken?.toUpperCase()
      );
      if (!voterToUpdate) {
        alert("Error: Voter key invalid.");
        setVoterStep(1);
        return;
      }
      if (voterToUpdate.hasVoted) {
        alert("You have already voted.");
        setVoterStep(1);
        return;
      }

      for (const pos of votingData.positions) {
        const selectedForPos = selectedIds.filter((id) => {
          const cand = votingData.candidates.find((c) => c.id === id);
          return cand?.positionId === pos.id;
        });
        if (selectedForPos.length > pos.maxSelections) {
          alert(`You have selected too many candidates for ${pos.title}.`);
          return;
        }
      }

      if (selectedIds.length === 0) {
        alert("Please select at least one candidate.");
        return;
      }

      const code = "0x" + Math.random().toString(16).substring(2, 10);
      const time = new Date().toLocaleString("en-HK", {
        dateStyle: "medium",
        timeStyle: "short",
      });

      const selectedCandidateNames = selectedIds.map(
        (id) =>
          votingData.candidates.find((c) => c.id === id)?.name || "Unknown"
      );

      const updated: ElectionData = {
        ...votingData,
        votes: [
          ...votingData.votes,
          {
            receiptCode: code,
            timestamp: time,
            selectedCandidateIds: [...selectedIds],
            selectedCandidateNames,
            voterToken: currentConfig.isSecretBallot
              ? undefined
              : voterToUpdate.token,
          } as VoteRecord,
        ],
        voters: votingData.voters.map((v) =>
          v.id === voterToUpdate.id
            ? { ...v, hasVoted: true, votedAt: time, receiptCode: code }
            : v
        ),
      };

      await saveToFirestore(updated);
      setReceiptId(code);
      setReceiptTime(time);
      setReceiptSelections([...selectedIds]);
      setVoterStep(5);
    } finally {
      setIsSubmittingVote(false);
    }
  };

  const handlePreviewSubmit = () => {
    setReceiptId(
      "PREVIEW-" + Math.random().toString(16).substring(2, 6).toUpperCase()
    );
    setReceiptTime(new Date().toLocaleString());
    setPreviewStep(5);
  };

  const printReceipt = () => {
    const printWindow = window.open("", "_blank", "width=600,height=750");
    if (!printWindow) {
      alert("Please allow pop-ups to print your receipt.");
      return;
    }

    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const electionTitle = votingData?.config.electionTitle || "";
    const thankYou = votingData?.config.thankYouMessage || "";

    const selectionsByPos = (votingData?.positions || [])
      .map((pos) => {
        const sel = (votingData?.candidates || [])
          .filter(
            (c) => receiptSelections.includes(c.id) && c.positionId === pos.id
          )
          .map((c) => c.name);
        return { posTitle: pos.title, names: sel };
      })
      .filter((group) => group.names.length > 0);

    const hash = makeReceiptHash(receiptId, receiptSelections, receiptTime);
    const verifyUrl = `${window.location.origin}/?verify=${encodeURIComponent(
      receiptId
    )}`;

    let selectionsHtml = "";
    selectionsByPos.forEach((group) => {
      selectionsHtml += `<div class="label">${escapeHtml(group.posTitle)}</div>
        <div class="selections">
          ${group.names
            .map((n) => `<div class="sel">✓ ${escapeHtml(n)}</div>`)
            .join("")}
        </div>`;
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Voting Receipt</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              color: #0f172a;
              padding: 40px;
              margin: 0;
            }
            .receipt {
              max-width: 480px;
              margin: 0 auto;
              border: 1px solid #cbd5e1;
              border-radius: 12px;
              padding: 32px;
            }
            .title { font-size: 20px; font-weight: bold; margin: 0 0 4px 0; text-align: center; }
            .sub { font-size: 13px; color: #64748b; text-align: center; margin: 0 0 24px 0; }
            .label { font-size: 11px; font-weight: bold; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; margin-top: 16px; }
            .code {
              font-family: monospace; font-size: 22px; font-weight: bold;
              background: #f8fafc; border: 1px solid #e2e8f0;
              border-radius: 6px; padding: 14px; text-align: center; letter-spacing: 1px;
            }
            .time { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 10px; }
            .selections { font-size: 14px; color: #1e293b; }
            .sel { padding: 4px 0; }
            .hash { font-family: monospace; font-size: 11px; color: #94a3b8; margin-top: 12px; }
            .verify { font-size: 12px; color: #2563eb; margin-top: 8px; word-break: break-all; }
            .message {
              font-size: 13px; color: #475569; text-align: center;
              margin-top: 24px; padding-top: 20px;
              border-top: 1px dashed #e2e8f0; line-height: 1.5;
            }
            .footer { font-size: 11px; color: #94a3b8; text-align: center; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="title">Vote Recorded</div>
            <div class="sub">${escapeHtml(electionTitle)}</div>
            <div class="label">Receipt Code</div>
            <div class="code">${escapeHtml(receiptId)}</div>
            <div class="time">${escapeHtml(receiptTime)}</div>
            ${selectionsHtml}
            <div class="hash">Hash: ${escapeHtml(hash)}</div>
            <div class="verify">Verify: ${escapeHtml(verifyUrl)}</div>
            <div class="message">${escapeHtml(thankYou)}</div>
            <div class="footer">Keep this receipt for your records.</div>
          </div>
          <script>
            window.onload = function () {
              window.focus();
              window.print();
              window.onafterprint = function () { window.close(); };
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const printSignInSheet = () => {
    if (!activeData) return;
    const printWindow = window.open("", "_blank", "width=900,height=800");
    if (!printWindow) {
      alert("Please allow pop-ups to print the sign-in sheet.");
      return;
    }

    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const sortedVoters = [...activeData.voters].sort((a, b) =>
      a.voterName.localeCompare(b.voterName)
    );

    const rows = sortedVoters
      .map(
        (v, index) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px 8px; text-align: center; color: #64748b; font-size: 13px;">${
          index + 1
        }</td>
        <td style="padding: 12px 8px; font-weight: 600; color: #0f172a; font-size: 14px;">${escapeHtml(
          v.voterName
        )}</td>
        <td style="padding: 12px 8px; color: #64748b; font-size: 13px;">${escapeHtml(
          v.email || ""
        )}</td>
        <td style="padding: 12px 8px; text-align: center;">
          <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; 
            background-color: ${v.hasVoted ? "#dcfce7" : "#f1f5f9"}; 
            color: ${v.hasVoted ? "#15803d" : "#64748b"};">
            ${v.hasVoted ? "VOTED" : "PENDING"}
          </span>
        </td>
        <td style="padding: 12px 8px; border-left: 1px dashed #cbd5e1;"></td>
      </tr>
    `
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Sign-In Sheet - ${escapeHtml(
            activeData.config.electionTitle
          )}</title>
          <style>
            @media print {
              body { padding: 0; }
              .no-print { display: none !important; }
              @page { size: A4 portrait; margin: 20mm; }
            }
            * { box-sizing: border-box; }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              color: #0f172a;
              padding: 40px;
              margin: 0;
            }
            .header { text-align: center; margin-bottom: 32px; border-bottom: 2px solid #0f172a; padding-bottom: 16px; }
            .title { font-size: 24px; font-weight: bold; margin: 0 0 8px 0; }
            .subtitle { font-size: 14px; color: #64748b; margin: 0; }
            .meta { display: flex; justify-content: space-between; margin-bottom: 24px; font-size: 13px; color: #475569; }
            table { width: 100%; border-collapse: collapse; text-align: left; }
            th { background-color: #f8fafc; padding: 12px 8px; font-size: 12px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #cbd5e1; font-weight: 600; }
            .print-btn { position: fixed; top: 20px; right: 20px; padding: 10px 20px; background-color: #0f172a; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          </style>
        </head>
        <body>
          <button class="print-btn no-print" onclick="window.print()">Print Sign-In Sheet</button>
          
          <div class="header">
            <h1 class="title">${escapeHtml(
              activeData.config.orgName
            )} - Voter Sign-In Sheet</h1>
            <p class="subtitle">${escapeHtml(
              activeData.config.electionTitle
            )}</p>
          </div>

          <div class="meta">
            <div><strong>Date:</strong> _______________________</div>
            <div><strong>Total Voters:</strong> ${
              activeData.voters.length
            }</div>
            <div><strong>Time:</strong> _______________________</div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th style="width: 30%;">Name</th>
                <th style="width: 30%;">Email</th>
                <th style="width: 15%; text-align: center;">Status</th>
                <th style="width: 25%; border-left: 1px dashed #cbd5e1;">Signature</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const downloadVoterCardsPDF = async () => {
    if (!activeData || activeData.voters.length === 0) return;

    // --- PROMPT FOR SETTINGS ---
    const cardsPerPageStr = window.prompt(
      "How many cards per A4 page? (Enter 4, 6, 8, or 9)",
      "4"
    );
    if (!cardsPerPageStr) return;
    const cardsPerPage = parseInt(cardsPerPageStr);
    if (![4, 6, 8, 9].includes(cardsPerPage)) {
      return alert("Please enter a valid number: 4, 6, 8, or 9.");
    }

    const showName = window.confirm(
      "Include Voter Name on the card?\n(Click OK for Yes, Cancel for No)"
    );
    const showKey = window.confirm(
      "Include Voter Access Key on the card?\n(Click OK for Yes, Cancel for No)"
    );

    // --- SETUP PDF ---
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 8;

    let cols = 2;
    let rows = 2;
    if (cardsPerPage === 6) {
      cols = 2;
      rows = 3;
    }
    if (cardsPerPage === 8) {
      cols = 2;
      rows = 4;
    }
    if (cardsPerPage === 9) {
      cols = 3;
      rows = 3;
    }

    const cardWidth = (pageWidth - margin * (cols + 1)) / cols;
    const cardHeight = (pageHeight - margin * (rows + 1)) / rows;

    const scale =
      cardsPerPage === 4
        ? 1
        : cardsPerPage === 6
        ? 0.9
        : cardsPerPage === 8
        ? 0.8
        : 0.75;
    const headerHeight = 10 * scale;

    // Instruction box height fixed to ensure safe calculations
    const instHeight = 18 * scale;

    const voters = activeData.voters;
    const { orgName, electionTitle, subsectorName } = activeData.config;

    // --- GENERATE CARDS ---
    for (let i = 0; i < voters.length; i++) {
      const voter = voters[i];

      const cardIndexOnPage = i % cardsPerPage;
      if (cardIndexOnPage === 0 && i > 0) {
        doc.addPage();
      }

      const col = cardIndexOnPage % cols;
      const row = Math.floor(cardIndexOnPage / cols);

      const x = margin + col * (cardWidth + margin);
      const y = margin + row * (cardHeight + margin);

      // 1. Draw Card Border & Background
      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, "FD");

      // 2. Draw Top Bar (Dark Green)
      doc.setFillColor(6, 78, 59);
      doc.roundedRect(x, y, cardWidth, headerHeight, 3, 3, "F");
      doc.setFillColor(6, 78, 59);
      doc.rect(x, y + headerHeight - 3, cardWidth, 3, "F");

      // Navy Blue Accent Line
      doc.setFillColor(30, 41, 59);
      doc.rect(x, y + headerHeight, cardWidth, 1 * scale, "F");

      // Org Name (Centered perfectly)
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9.5 * scale);
      doc.setFont("helvetica", "bold");
      doc.text(
        orgName || "VOTING",
        x + cardWidth / 2,
        y + headerHeight / 2 + 3.5 * scale,
        { align: "center" }
      );

      // 3. Title & Subtitle
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10 * scale);
      doc.setFont("helvetica", "bold");
      const titleLines = doc.splitTextToSize(electionTitle, cardWidth - 6);

      let currentY = y + headerHeight + 7 * scale;
      doc.text(titleLines, x + cardWidth / 2, currentY, { align: "center" });

      currentY += titleLines.length * 4 * scale;

      if (subsectorName) {
        doc.setFontSize(7.5 * scale);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(subsectorName, x + cardWidth / 2, currentY, {
          align: "center",
        });
        currentY += 3 * scale;
      }

      // Divider
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(x + 4, currentY, x + cardWidth - 4, currentY);

      // 4. Voter Info & QR Code (Placed in the "safe zone")
      // We calculate a safe zone between the divider and the instruction box
      const safeZoneTop = currentY + 4 * scale;
      const safeZoneBottom = y + cardHeight - instHeight - 4;
      const safeZoneHeight = safeZoneBottom - safeZoneTop;

      // QR code size adapts strictly to the safe zone height
      const qrSize = Math.min(cardWidth * 0.3, safeZoneHeight - 4);

      // Center the QR code vertically in the safe zone
      const qrX = x + cardWidth - qrSize - 4;
      const qrY = safeZoneTop + (safeZoneHeight - qrSize) / 2;

      const votingUrl = `${window.location.origin}/?token=${voter.token}&election=${activeData.config.id}`;
      try {
        const qrDataUrl = await QRCode.toDataURL(votingUrl, {
          margin: 0,
          width: 200,
        });
        doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
      } catch (err) {
        console.error("QR Code error", err);
      }

      // Voter Text (Aligned left, vertically centered with QR code)
      doc.setTextColor(15, 23, 42);
      let voterTextY = qrY + qrSize / 2 - (showKey ? 3 * scale : 0);
      const textX = x + 4;

      if (showName) {
        doc.setFontSize(11 * scale);
        doc.setFont("helvetica", "bold");
        const nameText = doc.splitTextToSize(
          voter.voterName || "Voter",
          cardWidth - qrSize - 10
        )[0];
        doc.text(nameText, textX, voterTextY);
        voterTextY += 4 * scale;
      }

      if (showKey) {
        doc.setFontSize(7 * scale);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(`Key: ${voter.token}`, textX, voterTextY);
      }

      // 5. Instruction Box (Pinned to bottom)
      const instY = y + cardHeight - instHeight - 4;

      doc.setFillColor(240, 253, 244);
      doc.roundedRect(x + 3, instY, cardWidth - 6, instHeight, 2, 2, "F");

      doc.setFontSize(6.5 * scale);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(6, 78, 59);
      doc.text("How to vote:", x + 5, instY + 4.5 * scale);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6 * scale);
      doc.setTextColor(71, 85, 105);

      const instructions = [
        "1. Scan QR code with your phone.",
        "2. Verify identity & review selections.",
        "3. Submit ballot before the deadline.",
      ];

      instructions.forEach((line, idx) => {
        doc.text(line, x + 5, instY + 8.5 * scale + idx * 3 * scale);
      });
    }

    doc.save(
      `Voter_Cards_${activeData.config.electionTitle.replace(
        /[^a-z0-9]/gi,
        "_"
      )}.pdf`
    );
  };

  const startPreview = () => {
    setIsPreviewActive(true);
    setPreviewStep(2);
    setPreviewAcknowledged(false);
    setPreviewSelectedIds([]);
  };
  const exitPreview = () => setIsPreviewActive(false);

  const openBackupModal = () => {
    setBackupSelection(dbState.map((e) => e.config.id));
    setIsBackupModalOpen(true);
  };
  const handleBackupCheckbox = (id: string) => {
    if (backupSelection.includes(id))
      setBackupSelection(backupSelection.filter((x) => x !== id));
    else setBackupSelection([...backupSelection, id]);
  };

  const executeBackup = () => {
    if (backupSelection.length === 0)
      return alert("Please select at least one election.");
    const toBackup = dbState.filter((el) =>
      backupSelection.includes(el.config.id)
    );
    const suffix =
      toBackup.length === 1
        ? `_${toBackup[0].config.electionTitle
            .replace(/[^a-z0-9]/gi, "_")
            .toLowerCase()}`
        : `_${toBackup.length}_elections`;
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(toBackup, null, 2));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `hkgbc_backup${suffix}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    setIsBackupModalOpen(false);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (Array.isArray(importedData)) {
          for (const el of importedData) {
            await setDoc(doc(db, "elections", el.config.id), el);
          }
          alert("Election data restored to Firebase!");
        }
      } catch (err) {
        alert("Error reading JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const deleteElection = (id: string) => {
    setModalConfig({
      isOpen: true,
      title: "Delete Election",
      message: "Are you sure? All votes will be lost forever.",
      confirmText: "Delete",
      isDanger: true,
      requireText: "delete",
      onConfirm: () => {
        deleteFromFirestore(id);
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const resetVoterStatus = (voterId: string) => {
    setModalConfig({
      isOpen: true,
      title: "Reset Voter",
      message:
        "Allow this voter to vote again? Their previous vote will be marked as VOIDED for the audit trail.",
      confirmText: "Reset",
      isDanger: true,
      onConfirm: () => {
        if (!activeData) return;
        const voter = activeData.voters.find((x) => x.id === voterId);
        const codeToVoid = voter?.receiptCode;

        const updated = {
          ...activeData,
          voters: activeData.voters.map((x) =>
            x.id === voterId
              ? {
                  ...x,
                  hasVoted: false,
                  votedAt: undefined,
                  receiptCode: undefined,
                }
              : x
          ),
          votes: activeData.votes.map((v) =>
            v.receiptCode === codeToVoid ? { ...v, isVoided: true } : v
          ),
        };
        saveToFirestore(updated);
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const deleteVoter = (voterId: string) => {
    setModalConfig({
      isOpen: true,
      title: "Delete Voter",
      message:
        "Delete this voter permanently? Their previous vote (if any) will be marked as VOIDED.",
      confirmText: "Delete",
      isDanger: true,
      onConfirm: () => {
        if (!activeData) return;
        const voter = activeData.voters.find((x) => x.id === voterId);
        const codeToVoid = voter?.receiptCode;

        saveToFirestore({
          ...activeData,
          voters: activeData.voters.filter((x) => x.id !== voterId),
          votes: activeData.votes.map((v) =>
            v.receiptCode === codeToVoid ? { ...v, isVoided: true } : v
          ),
        });
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleBatchDeleteVoters = () => {
    if (!activeData || selectedVoters.length === 0) return;

    setModalConfig({
      isOpen: true,
      title: "Batch Delete Voters",
      message: `Are you sure you want to delete ${selectedVoters.length} voter(s)? Their votes (if any) will be marked as VOIDED.`,
      confirmText: "Delete All",
      isDanger: true,
      onConfirm: () => {
        const codesToVoid = activeData.voters
          .filter((v) => selectedVoters.includes(v.id) && v.receiptCode)
          .map((v) => v.receiptCode);

        const updatedVoters = activeData.voters.filter(
          (v) => !selectedVoters.includes(v.id)
        );

        const updatedVotes = activeData.votes.map((v) =>
          codesToVoid.includes(v.receiptCode) ? { ...v, isVoided: true } : v
        );

        saveToFirestore({
          ...activeData,
          voters: updatedVoters,
          votes: updatedVotes,
        });

        setSelectedVoters([]);
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const saveCandidate = async () => {
    if (!candName || !activeData || isSavingCandidate || !candPositionId)
      return;
    setIsSavingCandidate(true);
    let updated;
    if (editingCandidateId) {
      updated = {
        ...activeData,
        candidates: activeData.candidates.map((c) =>
          c.id === editingCandidateId
            ? {
                ...c,
                name: candName,
                title: candTitle || "",
                positionId: candPositionId,
                imageUrl: candImage || "",
                infoUrl: candInfoUrl || "",
              }
            : c
        ),
      };
    } else {
      updated = {
        ...activeData,
        candidates: [
          ...activeData.candidates,
          {
            id: "c" + Date.now(),
            name: candName,
            title: candTitle || "",
            positionId: candPositionId,
            avatarBg: "#E2E8F0",
            imageUrl: candImage || "",
            infoUrl: candInfoUrl || "",
          },
        ],
      };
    }
    await saveToFirestore(updated);
    setIsSavingCandidate(false);
    setEditingCandidateId(null);
    setCandName("");
    setCandTitle("");
    setCandPositionId("");
    setCandImage(undefined);
    setCandInfoUrl("");
  };

  const startEditCandidate = (c: Candidate) => {
    setEditingCandidateId(c.id);
    setCandName(c.name);
    setCandTitle(c.title || "");
    setCandPositionId(c.positionId || "");
    setCandImage(c.imageUrl);
    setCandInfoUrl(c.infoUrl || "");
  };

  const saveSettings = async () => {
    if (editConfig && activeData && !isSavingSettings) {
      setIsSavingSettings(true);
      await saveToFirestore({
        ...activeData,
        config: editConfig,
        positions: editPositions,
      });
      setIsSavingSettings(false);
      alert("Saved successfully!");
    }
  };

  const launchElection = async () => {
    if (editConfig && activeData && !isLaunching) {
      for (const pos of editPositions) {
        const hasCandidates = activeData.candidates.some(
          (c) => c.positionId === pos.id
        );
        if (!hasCandidates) {
          alert(`Cannot launch: Position "${pos.title}" has no candidates.`);
          return;
        }
      }

      setIsLaunching(true);
      const updated = {
        ...activeData,
        config: { ...editConfig, isLaunched: true, isPaused: false },
        positions: editPositions,
      };
      await saveToFirestore(updated);
      setEditConfig(updated.config);
      setIsLaunching(false);
      alert("Launched!");
    }
  };

  const pauseElection = () => {
    setModalConfig({
      isOpen: true,
      title: "Pause",
      message: "Pause the election temporarily?",
      confirmText: "Pause",
      isDanger: true,
      onConfirm: () => {
        if (editConfig && activeData) {
          const updated = {
            ...activeData,
            config: { ...editConfig, isPaused: true },
          };
          saveToFirestore(updated);
          setEditConfig(updated.config);
        }
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const resumeElection = () => {
    if (editConfig && activeData) {
      const updated = {
        ...activeData,
        config: { ...editConfig, isPaused: false },
      };
      saveToFirestore(updated);
      setEditConfig(updated.config);
      alert("Resumed!");
    }
  };

  const forceEndElection = () => {
    setModalConfig({
      isOpen: true,
      title: "End Forever",
      message: "End the election permanently? This cannot be undone.",
      confirmText: "End",
      isDanger: true,
      onConfirm: () => {
        if (editConfig && activeData) {
          const now = new Date();
          const offset = now.getTimezoneOffset() * 60000;
          const localISOTime = new Date(now.getTime() - offset)
            .toISOString()
            .slice(0, 16);
          const updated = {
            ...activeData,
            config: {
              ...editConfig,
              isLaunched: false,
              isPaused: false,
              isHardEnded: true,
              endTime: localISOTime,
            },
          };
          saveToFirestore(updated);
          setEditConfig(updated.config);
        }
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const downloadResultsImage = () => {
    if (!activeData) return;

    const validVoteCount = activeData.votes.filter((v) => !v.isVoided).length;

    const resultsByPosition =
      activeData.positions?.map((pos) => {
        const candidatesForPos = activeData.candidates
          .filter((c) => c.positionId === pos.id)
          .map((c) => ({
            ...c,
            count: activeData.votes.filter(
              (v) => !v.isVoided && v.selectedCandidateIds.includes(c.id)
            ).length,
          }))
          .sort((a, b) => b.count - a.count);
        const maxVotes =
          candidatesForPos.length > 0 ? candidatesForPos[0].count : 0;
        const winners = candidatesForPos.filter(
          (c) => c.count === maxVotes && maxVotes > 0
        );
        const isTie = winners.length > 1;
        return { pos, candidates: candidatesForPos, maxVotes, isTie };
      }) || [];

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = 800;
    let totalHeight = 180; // Top header base height

    // PASS 1: Calculate exact height needed
    resultsByPosition.forEach(({ candidates, isTie }) => {
      if (candidates.length === 0) return;
      totalHeight += 40; // Position title spacing
      if (isTie) totalHeight += 60; // Tie warning box spacing
      totalHeight += candidates.length * 72; // Candidate boxes
      totalHeight += 32; // Space between positions
    });

    totalHeight += 60; // Bottom footer padding

    canvas.width = width * 2;
    canvas.height = totalHeight * 2;
    ctx.scale(2, 2);

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, totalHeight);

    // --- DRAW HEADER ---
    let currentY = 60;

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
    ctx.fillText(activeData.config.electionTitle, 40, currentY);
    currentY += 30;

    ctx.fillStyle = "#64748b";
    ctx.font = "16px system-ui, -apple-system, sans-serif";
    ctx.fillText(activeData.config.subsectorName, 40, currentY);
    currentY += 30;

    ctx.fillStyle = "#64748b";
    ctx.font = "14px system-ui, -apple-system, sans-serif";
    ctx.fillText(`Total Votes Cast: ${validVoteCount}`, 40, currentY);
    currentY += 20;

    // Header Divider
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, currentY);
    ctx.lineTo(width - 40, currentY);
    ctx.stroke();
    currentY += 32; // Space before positions

    // --- DRAW CONTENT ---
    resultsByPosition.forEach(({ pos, candidates, maxVotes, isTie }) => {
      if (candidates.length === 0) return;

      // Position Title
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
      ctx.fillText(pos.title.toUpperCase(), 40, currentY);

      // Tiny divider right below title
      currentY += 8;
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(40, currentY);
      ctx.lineTo(width - 40, currentY);
      ctx.stroke();
      currentY += 20;

      // Tie Warning
      if (isTie) {
        // Background Box
        ctx.fillStyle = "#fef2f2";
        ctx.beginPath();
        ctx.roundRect(40, currentY, width - 80, 40, 8);
        ctx.fill();
        ctx.strokeStyle = "#fecaca";
        ctx.stroke();

        // Triangle Icon
        ctx.fillStyle = "#dc2626";
        ctx.beginPath();
        ctx.moveTo(56, currentY + 12);
        ctx.lineTo(66, currentY + 28);
        ctx.lineTo(46, currentY + 28);
        ctx.closePath();
        ctx.fill();

        // Text
        ctx.fillStyle = "#991b1b";
        ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
        ctx.fillText(`Tie Detected for ${pos.title}!`, 78, currentY + 25);
        currentY += 56; // Move past the tie box
      }

      // Candidates
      candidates.forEach((c, idx) => {
        const isWinner =
          maxVotes > 0 && c.count === maxVotes && idx < pos.maxSelections;
        const pct =
          validVoteCount > 0 ? Math.round((c.count / validVoteCount) * 100) : 0;

        // Box Background
        ctx.fillStyle = isWinner ? "#ecfdf5" : "#f8fafc";
        ctx.beginPath();
        ctx.roundRect(40, currentY, width - 80, 56, 12);
        ctx.fill();

        // Box Border
        ctx.strokeStyle = isWinner ? "#a7f3d0" : "#e2e8f0";
        ctx.lineWidth = 1;
        ctx.stroke();

        let textX = 60;

        // Trophy Icon
        if (isWinner) {
          textX += 20;
          const tX = 52;
          const tY = currentY + 18;
          ctx.fillStyle = "#eab308";

          // Cup
          ctx.beginPath();
          ctx.moveTo(tX + 2, tY);
          ctx.lineTo(tX + 10, tY);
          ctx.lineTo(tX + 9, tY + 6);
          ctx.lineTo(tX + 3, tY + 6);
          ctx.fill();
          // Stem & Base
          ctx.fillRect(tX + 5, tY + 6, 2, 3);
          ctx.fillRect(tX + 2, tY + 9, 8, 2);
          // Handles
          ctx.beginPath();
          ctx.arc(tX + 1, tY + 3, 2, Math.PI / 2, (Math.PI * 3) / 2);
          ctx.strokeStyle = "#eab308";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(tX + 11, tY + 3, 2, -Math.PI / 2, Math.PI / 2);
          ctx.stroke();
        }

        // Candidate Name
        ctx.fillStyle = isWinner ? "#065f46" : "#1e293b";
        ctx.font = isWinner
          ? "bold 15px system-ui, -apple-system, sans-serif"
          : "15px system-ui, -apple-system, sans-serif";
        ctx.fillText(c.name, textX, currentY + 24);

        // Votes
        ctx.fillStyle = isWinner ? "#059669" : "#64748b";
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "right";
        ctx.fillText(`${c.count} votes (${pct}%)`, width - 60, currentY + 24);
        ctx.textAlign = "left";

        // Progress Bar Background
        const barY = currentY + 38;
        const barWidth = width - 120;
        ctx.fillStyle = isWinner ? "#d1fae5" : "#e2e8f0";
        ctx.beginPath();
        ctx.roundRect(60, barY, barWidth, 6, 3);
        ctx.fill();

        // Progress Bar Fill
        if (pct > 0) {
          ctx.fillStyle = isWinner ? "#059669" : "#94a3b8";
          ctx.beginPath();
          ctx.roundRect(60, barY, (barWidth * pct) / 100, 6, 3);
          ctx.fill();
        }

        currentY += 68; // Move down for next candidate (56 box + 12 margin)
      });

      currentY += 16; // Space between positions
    });

    // Footer
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      `Generated by ${activeData.config.orgName} Voting System`,
      width / 2,
      totalHeight - 40
    );

    // Download
    const link = document.createElement("a");
    link.download = `HKGBC_Election_Results_${activeData.config.id}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const displayTimeNow = currentTime.toLocaleString("en-HK", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  if (verifyCode) {
    if (isDbLoading) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f8fafc",
            color: "#0f172a",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                border: "4px solid #e2e8f0",
                borderTopColor: "#0f172a",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                margin: "0 auto 16px auto",
              }}
            ></div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            <h2>Verifying receipt...</h2>
          </div>
        </div>
      );
    }

    const vr = verifyResult;

    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#f8fafc",
          color: "#0f172a",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "48px 16px",
        }}
      >
        <div
          style={{
            maxWidth: "520px",
            margin: "0 auto",
            backgroundColor: "white",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
            padding: "32px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              marginBottom: "24px",
            }}
          >
            <HKGBCLogo height={48} />
            <h1
              style={{
                fontSize: "20px",
                fontWeight: "bold",
                margin: "16px 0 4px 0",
              }}
            >
              Receipt Verification
            </h1>
            <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>
              Code:{" "}
              <span style={{ fontFamily: "monospace" }}>{verifyCode}</span>
            </p>
          </div>

          {!vr ? (
            <div
              style={{
                textAlign: "center",
                padding: "32px 16px",
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
              }}
            >
              <AlertTriangle
                size={40}
                style={{ color: "#dc2626", margin: "0 auto 12px auto" }}
              />
              <h2
                style={{
                  fontSize: "16px",
                  fontWeight: "bold",
                  color: "#991b1b",
                  marginBottom: "8px",
                }}
              >
                Receipt Not Found
              </h2>
              <p style={{ fontSize: "13px", color: "#7f1d1d", margin: 0 }}>
                This receipt code does not match any recorded vote. Please
                double-check the code.
              </p>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "14px 16px",
                  backgroundColor: vr.vote.isVoided ? "#f1f5f9" : "#ecfdf5",
                  border: `1px solid ${
                    vr.vote.isVoided ? "#cbd5e1" : "#a7f3d0"
                  }`,
                  borderRadius: "8px",
                  marginBottom: "20px",
                }}
              >
                {vr.vote.isVoided ? (
                  <AlertTriangle
                    size={22}
                    style={{ color: "#64748b", flexShrink: 0 }}
                  />
                ) : (
                  <CheckCircle2
                    size={22}
                    style={{ color: "#059669", flexShrink: 0 }}
                  />
                )}
                <div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: "bold",
                      color: vr.vote.isVoided ? "#334155" : "#065f46",
                    }}
                  >
                    {vr.vote.isVoided ? "Receipt Voided" : "✓ Receipt Verified"}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: vr.vote.isVoided ? "#64748b" : "#047857",
                    }}
                  >
                    {vr.vote.isVoided
                      ? "This ballot was voided by an administrator."
                      : "This ballot was recorded in our system."}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  fontSize: "14px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: "bold",
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      marginBottom: "2px",
                    }}
                  >
                    Election
                  </div>
                  <div style={{ fontWeight: 500 }}>
                    {vr.election.config.electionTitle}
                  </div>
                  <div style={{ fontSize: "13px", color: "#64748b" }}>
                    {vr.election.config.subsectorName}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: "bold",
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      marginBottom: "2px",
                    }}
                  >
                    Recorded At
                  </div>
                  <div>{vr.vote.timestamp}</div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: "bold",
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      marginBottom: "6px",
                    }}
                  >
                    Your Selections ({vr.vote.selectedCandidateIds.length})
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      textDecoration: vr.vote.isVoided
                        ? "line-through"
                        : "none",
                      opacity: vr.vote.isVoided ? 0.6 : 1,
                    }}
                  >
                    {vr.vote.selectedCandidateIds.map((id) => {
                      const c = vr.election.candidates.find((x) => x.id === id);
                      return c ? (
                        <div
                          key={id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <Check
                            style={{
                              width: "14px",
                              height: "14px",
                              color: vr.vote.isVoided ? "#64748b" : "#059669",
                              flexShrink: 0,
                            }}
                          />
                          {c.name}
                        </div>
                      ) : (
                        <div
                          key={id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <Check
                            style={{
                              width: "14px",
                              height: "14px",
                              color: vr.vote.isVoided ? "#64748b" : "#059669",
                              flexShrink: 0,
                            }}
                          />
                          (Deleted Candidate)
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div
                  style={{
                    borderTop: "1px dashed #e2e8f0",
                    paddingTop: "12px",
                    fontFamily: "monospace",
                    fontSize: "11px",
                    color: "#94a3b8",
                  }}
                >
                  Hash:{" "}
                  {makeReceiptHash(
                    vr.vote.receiptCode,
                    vr.vote.selectedCandidateIds,
                    vr.vote.timestamp
                  )}
                </div>
              </div>
            </>
          )}

          <div
            style={{
              marginTop: "24px",
              paddingTop: "16px",
              borderTop: "1px solid #e2e8f0",
              fontSize: "11px",
              color: "#94a3b8",
              textAlign: "center",
            }}
          >
            Powered by HKGBC Voting System
          </div>
        </div>
      </div>
    );
  }

  if (isDbLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8fafc",
          color: "#0f172a",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "4px solid #e2e8f0",
              borderTopColor: "#0f172a",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px auto",
            }}
          ></div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <h2>Connecting to HKGBC Database...</h2>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f8fafc",
        color: "#0f172a",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* CONFIRM MODAL */}
      {modalConfig.isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "400px",
              width: "90%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "16px",
                color: modalConfig.isDanger ? "#e11d48" : "#0f172a",
              }}
            >
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "bold" }}>
                {modalConfig.title}
              </h3>
            </div>
            <p
              style={{
                fontSize: "14px",
                color: "#475569",
                lineHeight: "1.5",
                marginBottom: "24px",
              }}
            >
              {modalConfig.message}
            </p>

            {modalConfig.requireText && (
              <div style={{ marginBottom: "24px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    color: "#475569",
                    marginBottom: "8px",
                  }}
                >
                  Please type{" "}
                  <strong style={{ color: "#0f172a" }}>
                    {modalConfig.requireText}
                  </strong>{" "}
                  to confirm:
                </label>
                <input
                  type="text"
                  value={modalInputText}
                  onChange={(e) => setModalInputText(e.target.value)}
                  placeholder={`Type ${modalConfig.requireText}...`}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    outline: "none",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#0f172a")}
                  onBlur={(e) => (e.target.style.borderColor = "#cbd5e1")}
                />
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
              }}
            >
              <button
                onClick={() => {
                  setModalConfig((prev) => ({ ...prev, isOpen: false }));
                  setModalInputText("");
                }}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  fontWeight: 500,
                  fontSize: "14px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (
                    modalConfig.requireText &&
                    modalInputText !== modalConfig.requireText
                  ) {
                    return alert(
                      `Please type "${modalConfig.requireText}" to confirm.`
                    );
                  }
                  modalConfig.onConfirm();
                  setModalInputText("");
                }}
                disabled={
                  modalConfig.requireText
                    ? modalInputText !== modalConfig.requireText
                    : false
                }
                style={{
                  padding: "8px 16px",
                  backgroundColor: modalConfig.isDanger ? "#e11d48" : "#0f172a",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 500,
                  fontSize: "14px",
                  cursor:
                    modalConfig.requireText &&
                    modalInputText !== modalConfig.requireText
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    modalConfig.requireText &&
                    modalInputText !== modalConfig.requireText
                      ? 0.5
                      : 1,
                  fontFamily: "inherit",
                }}
              >
                {modalConfig.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBMIT CONFIRMATION MODAL */}
      {isSubmitConfirmOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "400px",
              width: "90%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "16px",
                color: "#0f172a",
              }}
            >
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "bold" }}>
                Confirm Your Vote
              </h3>
            </div>
            <p
              style={{
                fontSize: "14px",
                color: "#475569",
                lineHeight: "1.5",
                marginBottom: "24px",
              }}
            >
              Once submitted, your ballot is{" "}
              <strong>final and cannot be changed</strong>. Are you sure you
              want to submit?
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
              }}
            >
              <button
                onClick={() => setIsSubmitConfirmOpen(false)}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  fontWeight: 500,
                  fontSize: "14px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleBallotSubmit}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#0f172a",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 500,
                  fontSize: "14px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Yes, Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BACKUP CHOICE MODAL */}
      {isBackupModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "500px",
              width: "90%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              display: "flex",
              flexDirection: "column",
              maxHeight: "80vh",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "8px",
                color: "#0f172a",
              }}
            >
              <Database size={24} />
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "bold" }}>
                Select Data to Backup
              </h3>
            </div>
            <p
              style={{
                fontSize: "14px",
                color: "#475569",
                marginBottom: "16px",
              }}
            >
              Select the specific elections you want to export.
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <button
                onClick={() =>
                  setBackupSelection(dbState.map((e) => e.config.id))
                }
                style={{
                  fontSize: "13px",
                  color: "#2563eb",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Select All
              </button>
              <button
                onClick={() => setBackupSelection([])}
                style={{
                  fontSize: "13px",
                  color: "#64748b",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Deselect All
              </button>
            </div>
            <div
              style={{
                overflowY: "auto",
                flex: 1,
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "8px",
                marginBottom: "24px",
              }}
            >
              {dbState.map((el) => (
                <label
                  key={el.config.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    padding: "12px",
                    cursor: "pointer",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={backupSelection.includes(el.config.id)}
                    onChange={() => handleBackupCheckbox(el.config.id)}
                    style={{
                      marginTop: "2px",
                      width: "18px",
                      height: "18px",
                      cursor: "pointer",
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: "bold",
                        color: "#0f172a",
                      }}
                    >
                      {el.config.electionTitle}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                      {el.votes.length} Votes • {el.voters.length} Voters
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => setIsBackupModalOpen(false)}
                style={{
                  flex: 1,
                  padding: "10px",
                  backgroundColor: "#f1f5f9",
                  color: "#334155",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontWeight: 500,
                  fontSize: "14px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
              <button
                onClick={executeBackup}
                style={{
                  flex: 1,
                  padding: "10px",
                  backgroundColor: "#0F172A",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: 500,
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  fontFamily: "inherit",
                }}
              >
                <Download size={16} /> Download ({backupSelection.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header
        style={{
          backgroundColor: "white",
          borderBottom: "1px solid #e2e8f0",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <HKGBCLogo height={36} />
          <span
            style={{
              fontWeight: "bold",
              fontSize: "18px",
              letterSpacing: "-0.5px",
            }}
          >
            {isPreviewActive
              ? "HKGBC Voting (Preview)"
              : viewMode === "admin"
              ? "HKGBC Election Center"
              : viewMode === "scrutineer"
              ? "HKGBC Voting"
              : "HKGBC Voting"}
          </span>
        </div>

        {viewMode === "scrutineer" && isScrutineerAuth && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "#fef3c7",
              padding: "6px 12px",
              borderRadius: "6px",
              color: "#92400e",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            <ShieldCheck size={16} /> Scrutineer Mode
          </div>
        )}

        {viewMode === "admin" && isAdminAuth && !isPreviewActive && (
          <div style={{ display: "flex", gap: "12px" }}>
            <label
              style={{
                padding: "6px 12px",
                backgroundColor: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontFamily: "inherit",
              }}
            >
              <Upload size={16} /> Import
              <input
                type="file"
                accept=".json"
                style={{ display: "none" }}
                onChange={handleImportJSON}
              />
            </label>
            <button
              onClick={openBackupModal}
              style={{
                padding: "6px 12px",
                backgroundColor: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontFamily: "inherit",
              }}
            >
              <Download size={16} /> Backup
            </button>
            <button
              onClick={() => setIsAdminAuth(false)}
              style={{
                padding: "6px 12px",
                backgroundColor: "#fff1f2",
                color: "#e11d48",
                border: "1px solid #fecdd3",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: "14px",
                fontFamily: "inherit",
              }}
            >
              Sign Out
            </button>
          </div>
        )}
      </header>

      {isPreviewActive && (
        <div
          style={{
            backgroundColor: "#fef3c7",
            color: "#92400e",
            padding: "12px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid #fde68a",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 500,
            }}
          >
            <Eye size={18} /> Preview Mode: Votes are not saved.
          </div>
          <button
            onClick={exitPreview}
            style={{
              padding: "6px 12px",
              backgroundColor: "#fde68a",
              color: "#92400e",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontFamily: "inherit",
            }}
          >
            <X size={16} /> Exit Preview
          </button>
        </div>
      )}

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: "48px",
          paddingBottom: "100px",
          paddingLeft: "16px",
          paddingRight: "16px",
        }}
      >
        {viewMode === "scrutineer" && (
          <div style={{ width: "100%", maxWidth: "1000px" }}>
            {!isScrutineerAuth ? (
              <div
                style={{
                  width: "100%",
                  maxWidth: "440px",
                  margin: "0 auto",
                  backgroundColor: "white",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
                  padding: "32px",
                }}
              >
                <div
                  style={{
                    marginBottom: "24px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                  }}
                >
                  <ShieldCheck
                    size={48}
                    style={{ color: "#f59e0b", marginBottom: "16px" }}
                  />
                  <h1
                    style={{
                      fontSize: "24px",
                      fontWeight: "bold",
                      margin: "0 0 4px 0",
                    }}
                  >
                    Scrutineer Login
                  </h1>
                  <p style={{ color: "#64748b", fontSize: "15px", margin: 0 }}>
                    Enter the password provided by the Admin.
                  </p>
                </div>
                <form
                  onSubmit={handleScrutineerLogin}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "14px",
                        fontWeight: 500,
                        color: "#334155",
                        marginBottom: "6px",
                      }}
                    >
                      Password
                    </label>
                    <input
                      type="password"
                      placeholder="Enter scrutineer password"
                      value={scrutineerPassInput}
                      onChange={(e) => setScrutineerPassInput(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        fontSize: "14px",
                        outline: "none",
                        boxSizing: "border-box",
                        fontFamily: "inherit",
                      }}
                      required
                    />
                  </div>
                  {scrutineerError && (
                    <p
                      style={{ fontSize: "14px", color: "#ef4444", margin: 0 }}
                    >
                      {scrutineerError}
                    </p>
                  )}
                  <button
                    type="submit"
                    style={{
                      width: "100%",
                      padding: "10px",
                      backgroundColor: "#0F172A",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      fontWeight: 500,
                      fontSize: "14px",
                      cursor: "pointer",
                      marginTop: "4px",
                      fontFamily: "inherit",
                    }}
                  >
                    Access Portal
                  </button>
                </form>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: "white",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  overflow: "hidden",
                  minHeight: "600px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    borderBottom: "1px solid #e2e8f0",
                    padding: "24px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: "#f8fafc",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                    }}
                  >
                    <div>
                      <h2
                        style={{
                          fontSize: "20px",
                          fontWeight: "bold",
                          margin: "0 0 4px 0",
                        }}
                      >
                        {activeData?.config.electionTitle}
                      </h2>
                      <p
                        style={{
                          fontSize: "14px",
                          color: "#64748b",
                          margin: 0,
                        }}
                      >
                        Read-Only Observation Mode
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    borderBottom: "1px solid #e2e8f0",
                    padding: "0 24px",
                    paddingTop: "8px",
                    overflowX: "auto",
                  }}
                >
                  <div
                    style={{
                      padding: "12px 16px",
                      fontSize: "14px",
                      fontWeight: 500,
                      borderBottom: "2px solid #0f172a",
                      color: "#0f172a",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <BarChart
                      size={16}
                      style={{
                        display: "inline",
                        marginRight: "6px",
                        verticalAlign: "text-bottom",
                      }}
                    />{" "}
                    Live Results
                  </div>
                </div>

                <div style={{ padding: "32px", flex: 1 }}>
                  {activeData &&
                    (() => {
                      const isEnded =
                        activeData.config.isHardEnded ||
                        (!activeData.config.isLaunched &&
                          !!activeData.config.startTime) ||
                        (!!activeData.config.endTime &&
                          currentTime.getTime() >
                            parseLocalTime(activeData.config.endTime)!);

                      // Scrutineers NEVER see candidate vote counts, regardless of
                      // the sealResults setting. Only aggregate stats + audit log.
                      const validVoteCount = activeData.votes.filter(
                        (v) => !v.isVoided
                      ).length;

                      return (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "24px",
                            maxWidth: "800px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: "16px",
                              flexWrap: "wrap",
                              marginBottom: "16px",
                            }}
                          >
                            <div
                              style={{
                                backgroundColor: "#f8fafc",
                                padding: "16px",
                                borderRadius: "12px",
                                flex: 1,
                                minWidth: "150px",
                                border: "1px solid #e2e8f0",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "12px",
                                  textTransform: "uppercase",
                                  color: "#64748b",
                                  fontWeight: "bold",
                                }}
                              >
                                Total Voters
                              </div>
                              <div
                                style={{
                                  fontSize: "24px",
                                  fontWeight: "bold",
                                  color: "#0f172a",
                                }}
                              >
                                {activeData.voters.length}
                              </div>
                            </div>
                            <div
                              style={{
                                backgroundColor: "#f8fafc",
                                padding: "16px",
                                borderRadius: "12px",
                                flex: 1,
                                minWidth: "150px",
                                border: "1px solid #e2e8f0",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "12px",
                                  textTransform: "uppercase",
                                  color: "#64748b",
                                  fontWeight: "bold",
                                }}
                              >
                                Votes Cast
                              </div>
                              <div
                                style={{
                                  fontSize: "24px",
                                  fontWeight: "bold",
                                  color: "#0f172a",
                                }}
                              >
                                {validVoteCount}
                              </div>
                            </div>

                            {/* TURNOUT WITH VOTED/PENDING DETAILS */}
                            <div
                              style={{
                                backgroundColor: "#f8fafc",
                                padding: "16px",
                                borderRadius: "12px",
                                flex: 1,
                                minWidth: "150px",
                                border: "1px solid #e2e8f0",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "12px",
                                  textTransform: "uppercase",
                                  color: "#64748b",
                                  fontWeight: "bold",
                                }}
                              >
                                Turnout
                              </div>
                              <div
                                style={{
                                  fontSize: "24px",
                                  fontWeight: "bold",
                                  color: "#0f172a",
                                }}
                              >
                                {activeData.voters.length > 0
                                  ? Math.round(
                                      (activeData.voters.filter(
                                        (v) => v.hasVoted
                                      ).length /
                                        activeData.voters.length) *
                                        100
                                    )
                                  : 0}
                                %
                              </div>
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "#64748b",
                                  marginTop: "4px",
                                }}
                              >
                                {
                                  activeData.voters.filter((v) => v.hasVoted)
                                    .length
                                }{" "}
                                voted /{" "}
                                {
                                  activeData.voters.filter((v) => !v.hasVoted)
                                    .length
                                }{" "}
                                pending (Total: {activeData.voters.length})
                              </div>
                            </div>

                            {/* TOTAL POSITIONS BOX */}
                            <div
                              style={{
                                backgroundColor: "#f8fafc",
                                padding: "16px",
                                borderRadius: "12px",
                                flex: 1,
                                minWidth: "150px",
                                border: "1px solid #e2e8f0",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "12px",
                                  textTransform: "uppercase",
                                  color: "#64748b",
                                  fontWeight: "bold",
                                }}
                              >
                                Total Positions
                              </div>
                              <div
                                style={{
                                  fontSize: "24px",
                                  fontWeight: "bold",
                                  color: "#0f172a",
                                }}
                              >
                                {activeData.positions?.length || 0}
                              </div>
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "#64748b",
                                  marginTop: "4px",
                                }}
                              >
                                Being elected
                              </div>
                            </div>

                            <div
                              style={{
                                backgroundColor: "#f8fafc",
                                padding: "16px",
                                borderRadius: "12px",
                                flex: 1,
                                minWidth: "150px",
                                border: "1px solid #e2e8f0",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "12px",
                                  textTransform: "uppercase",
                                  color: "#64748b",
                                  fontWeight: "bold",
                                }}
                              >
                                Status
                              </div>
                              <div
                                style={{
                                  fontSize: "24px",
                                  fontWeight: "bold",
                                  color: isEnded ? "#059669" : "#f59e0b",
                                }}
                              >
                                {isEnded ? "FINAL" : "LIVE"}
                              </div>
                            </div>
                          </div>

                          {/* Candidate vote tallies are intentionally NOT shown to
                      scrutineers — only aggregate stats and the voided log. */}

                          <div
                            style={{
                              backgroundColor: "white",
                              borderRadius: "12px",
                              border: "1px solid #e2e8f0",
                              padding: "24px",
                              marginTop: "24px",
                            }}
                          >
                            <h2
                              style={{
                                fontSize: "18px",
                                fontWeight: "bold",
                                marginBottom: "16px",
                                color: "#e11d48",
                              }}
                            >
                              Voided Ballots Audit Log
                            </h2>
                            <p
                              style={{
                                fontSize: "14px",
                                color: "#64748b",
                                marginBottom: "16px",
                              }}
                            >
                              This shows any ballots that were voided by the
                              Admin. (For secret ballot, no voter names are
                              shown).
                            </p>
                            {activeData.votes.filter((v) => v.isVoided)
                              .length === 0 ? (
                              <p style={{ color: "#64748b", fontSize: "14px" }}>
                                No ballots have been voided.
                              </p>
                            ) : (
                              <table
                                style={{
                                  width: "100%",
                                  fontSize: "14px",
                                  textAlign: "left",
                                }}
                              >
                                <thead>
                                  <tr style={{ backgroundColor: "#f8fafc" }}>
                                    <th style={{ padding: "8px" }}>
                                      Receipt Code
                                    </th>
                                    <th style={{ padding: "8px" }}>
                                      Timestamp
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {activeData.votes
                                    .filter((v) => v.isVoided)
                                    .map((v) => (
                                      <tr
                                        key={v.receiptCode}
                                        style={{
                                          borderBottom: "1px solid #f1f5f9",
                                        }}
                                      >
                                        <td
                                          style={{
                                            padding: "8px",
                                            fontFamily: "monospace",
                                          }}
                                        >
                                          {v.receiptCode}
                                        </td>
                                        <td
                                          style={{
                                            padding: "8px",
                                            color: "#64748b",
                                          }}
                                        >
                                          {v.timestamp}
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                </div>
              </div>
            )}
          </div>
        )}
        {isPreviewActive && activeData && (
          <div
            style={{
              width: "100%",
              maxWidth: "440px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {previewStep === 2 && (
              <div
                style={{
                  width: "100%",
                  backgroundColor: "white",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
                  padding: "32px",
                }}
              >
                <h1
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    marginBottom: "8px",
                  }}
                >
                  {activeData.config.electionTitle}
                </h1>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#64748b",
                    marginBottom: "24px",
                  }}
                >
                  {activeData.config.loginSubtitle}
                </p>
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "16px",
                    marginBottom: "24px",
                  }}
                >
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#334155",
                      lineHeight: "1.6",
                      margin: 0,
                    }}
                  >
                    {activeData.config.acknowledgmentText}
                  </p>
                </div>
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    cursor: "pointer",
                    marginBottom: "24px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={previewAcknowledged}
                    onChange={() =>
                      setPreviewAcknowledged(!previewAcknowledged)
                    }
                    style={{ marginTop: "4px" }}
                  />
                  <span style={{ fontSize: "14px", color: "#334155" }}>
                    I confirm my identity and acknowledge the rules.
                  </span>
                </label>
                <button
                  disabled={!previewAcknowledged}
                  onClick={() => setPreviewStep(3)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    backgroundColor: previewAcknowledged
                      ? "#0F172A"
                      : "#f1f5f9",
                    color: previewAcknowledged ? "white" : "#94a3b8",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 500,
                    fontSize: "14px",
                    cursor: previewAcknowledged ? "pointer" : "not-allowed",
                    fontFamily: "inherit",
                  }}
                >
                  Continue
                </button>
              </div>
            )}
            {previewStep === 3 && (
              <div
                style={{
                  width: "100%",
                  maxWidth: "600px",
                  backgroundColor: "white",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                    padding: "24px",
                  }}
                >
                  <h2
                    style={{
                      fontSize: "18px",
                      fontWeight: "bold",
                      margin: "0 0 4px 0",
                    }}
                  >
                    {activeData.config.subsectorName}
                  </h2>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#64748b",
                      margin: "0 0 12px 0",
                    }}
                  >
                    {activeData.config.instructionsText}
                  </p>
                  <div
                    style={{
                      display: "inline-block",
                      backgroundColor: "#e2e8f0",
                      color: "#334155",
                      padding: "4px 12px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  >
                    {previewSelectedIds.length} Selected
                  </div>
                </div>
                <div
                  style={{
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "24px",
                  }}
                >
                  {activeData.positions?.map((pos) => {
                    const posCandidates = activeData.candidates.filter(
                      (c) => c.positionId === pos.id
                    );
                    if (posCandidates.length === 0) return null;
                    return (
                      <div
                        key={pos.id}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            backgroundColor: "#f1f5f9",
                            padding: "12px 16px",
                            borderBottom: "1px solid #e2e8f0",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div
                              style={{ fontWeight: "bold", color: "#0f172a" }}
                            >
                              {pos.title}
                            </div>
                            <div
                              style={{
                                fontSize: "12px",
                                backgroundColor: "#e2e8f0",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                color: "#475569",
                              }}
                            >
                              Select up to {pos.maxSelections}
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            padding: "12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          {posCandidates.map((c) => {
                            const isSelected = previewSelectedIds.includes(
                              c.id
                            );
                            return (
                              <div
                                key={c.id}
                                onClick={() =>
                                  toggleCandidateSelection(c.id, pos.id, true)
                                }
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "16px",
                                  padding: "16px",
                                  borderRadius: "8px",
                                  border: `1px solid ${
                                    isSelected ? "#0f172a" : "#e2e8f0"
                                  }`,
                                  backgroundColor: isSelected
                                    ? "#f8fafc"
                                    : "white",
                                  cursor: "pointer",
                                }}
                              >
                                <div
                                  style={{
                                    width: "20px",
                                    height: "20px",
                                    borderRadius: "4px",
                                    border: `1px solid ${
                                      isSelected ? "#0f172a" : "#cbd5e1"
                                    }`,
                                    backgroundColor: isSelected
                                      ? "#0f172a"
                                      : "white",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                  }}
                                >
                                  {isSelected && (
                                    <Check
                                      style={{
                                        width: "14px",
                                        height: "14px",
                                        color: "white",
                                      }}
                                    />
                                  )}
                                </div>
                                <div>
                                  <div
                                    style={{
                                      fontWeight: 500,
                                      color: "#0f172a",
                                    }}
                                  >
                                    {c.name}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: "14px",
                                      color: "#64748b",
                                    }}
                                  >
                                    {c.title}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div
                  style={{ padding: "16px", borderTop: "1px solid #e2e8f0" }}
                >
                  <button
                    onClick={() => {
                      if (previewSelectedIds.length > 0) setPreviewStep(4);
                    }}
                    style={{
                      width: "100%",
                      padding: "10px",
                      backgroundColor: "#0F172A",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      fontWeight: 500,
                      fontSize: "14px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Review Selections
                  </button>
                </div>
              </div>
            )}
            {previewStep === 4 && (
              <div
                style={{
                  width: "100%",
                  backgroundColor: "white",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
                  padding: "32px",
                }}
              >
                <h1
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    marginBottom: "8px",
                  }}
                >
                  Review Ballot
                </h1>
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "16px",
                    marginBottom: "24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  {activeData.positions?.map((pos) => {
                    const names = previewSelectedIds
                      .map((id) =>
                        activeData.candidates.find((c) => c.id === id)
                      )
                      .filter((c) => c?.positionId === pos.id && c)
                      .map((c) => c?.name);
                    if (names.length === 0) return null;
                    return (
                      <div key={pos.id}>
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: "bold",
                            color: "#64748b",
                            marginBottom: "8px",
                            textTransform: "uppercase",
                          }}
                        >
                          {pos.title}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          {names.map((n, i) => (
                            <div
                              key={i}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                fontSize: "14px",
                                fontWeight: 500,
                                color: "#1e293b",
                              }}
                            >
                              <Check
                                style={{
                                  width: "16px",
                                  height: "16px",
                                  color: "#0f172a",
                                }}
                              />{" "}
                              {n}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={handlePreviewSubmit}
                  style={{
                    width: "100%",
                    padding: "10px",
                    backgroundColor: "#0F172A",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 500,
                    fontSize: "14px",
                    cursor: "pointer",
                    marginBottom: "12px",
                    fontFamily: "inherit",
                  }}
                >
                  Confirm & Submit (Preview)
                </button>
                <button
                  onClick={() => setPreviewStep(3)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    backgroundColor: "white",
                    color: "#334155",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    fontWeight: 500,
                    fontSize: "14px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Back to Edit
                </button>
              </div>
            )}
            {previewStep === 5 && (
              <div
                style={{
                  width: "100%",
                  backgroundColor: "white",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
                  padding: "32px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    backgroundColor: "#ecfdf5",
                    color: "#10b981",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px auto",
                  }}
                >
                  <CheckCircle2 size={32} />
                </div>
                <h1
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    marginBottom: "8px",
                  }}
                >
                  Preview Complete
                </h1>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#64748b",
                    marginBottom: "32px",
                  }}
                >
                  {activeData.config.thankYouMessage}
                </p>
                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "20px",
                    textAlign: "left",
                    marginBottom: "24px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      marginBottom: "4px",
                    }}
                  >
                    Receipt Code
                  </div>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: "20px",
                      fontWeight: "bold",
                      color: "#0f172a",
                      backgroundColor: "#f8fafc",
                      padding: "12px",
                      borderRadius: "4px",
                      border: "1px solid #f1f5f9",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    {receiptId}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#94a3b8",
                      marginTop: "8px",
                      textAlign: "center",
                    }}
                  >
                    🕒 {receiptTime}
                  </div>
                </div>
                <button
                  onClick={exitPreview}
                  style={{
                    padding: "10px 24px",
                    backgroundColor: "#0F172A",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 500,
                    fontSize: "14px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Return to Admin
                </button>
              </div>
            )}
          </div>
        )}

        {/* 
          ============================================================
          Voter View
          ============================================================
        */}
        {!isPreviewActive && viewMode === "voter" && (
          <div
            style={{
              width: "100%",
              maxWidth: "440px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {voterStatus === "open" && voterStep >= 1 && voterStep <= 3 && (
              <>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginBottom: "24px",
                    width: "100%",
                    justifyContent: "center",
                  }}
                >
                  {[1, 2, 3].map((step) => (
                    <div
                      key={step}
                      style={{
                        flex: 1,
                        height: "6px",
                        borderRadius: "999px",
                        backgroundColor:
                          voterStep >= step ? "#0f172a" : "#e2e8f0",
                        transition: "background-color 0.3s ease",
                      }}
                    />
                  ))}
                </div>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#64748b",
                    marginBottom: "16px",
                    fontWeight: 500,
                  }}
                >
                  Step {voterStep} of 3
                </p>
              </>
            )}

            {voterStatus === "invalid" ? (
              <div
                style={{
                  backgroundColor: "white",
                  padding: "40px 32px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  textAlign: "center",
                  width: "100%",
                  boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    backgroundColor: "#fef2f2",
                    color: "#ef4444",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px auto",
                  }}
                >
                  <AlertTriangle size={32} />
                </div>
                <h1
                  style={{
                    color: "#0f172a",
                    marginBottom: "16px",
                    fontSize: "24px",
                    fontWeight: "bold",
                  }}
                >
                  Invalid Link
                </h1>
                <p
                  style={{
                    color: "#64748b",
                    lineHeight: "1.6",
                    marginBottom: "24px",
                    fontSize: "15px",
                  }}
                >
                  We could not find your voter key in our system. Please check
                  the URL you entered.
                </p>
                <div
                  style={{
                    padding: "16px",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    color: "#334155",
                    fontSize: "14px",
                    fontWeight: 500,
                  }}
                >
                  If you believe this is an error, please contact the HKGBC
                  Secretary for assistance.
                </div>
              </div>
            ) : voterStatus === "voted" ? (
              <div
                style={{
                  backgroundColor: "white",
                  padding: "32px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  textAlign: "center",
                  width: "100%",
                  boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
                }}
              >
                <CheckCircle2
                  size={48}
                  style={{ color: "#10b981", margin: "0 auto 16px auto" }}
                />
                <h1
                  style={{
                    color: "#0f172a",
                    marginBottom: "8px",
                    fontSize: "24px",
                    fontWeight: "bold",
                  }}
                >
                  Ballot Already Cast
                </h1>
                <p
                  style={{
                    color: "#64748b",
                    lineHeight: "1.6",
                    marginBottom: "24px",
                  }}
                >
                  Our records show that you have already voted in this election.
                  Each link can only be used once.
                </p>
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    padding: "20px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    textAlign: "left",
                    marginBottom: "24px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      marginBottom: "4px",
                    }}
                  >
                    Your Receipt Code
                  </div>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: "20px",
                      fontWeight: "bold",
                      color: "#0f172a",
                      backgroundColor: "white",
                      padding: "12px",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    {currentVoter?.receiptCode || "N/A"}
                    {currentVoter?.receiptCode && (
                      <button
                        onClick={() =>
                          safeCopyText(
                            currentVoter.receiptCode || "",
                            "receipt"
                          )
                        }
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#94a3b8",
                        }}
                      >
                        <Copy size={16} />
                      </button>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#94a3b8",
                      marginTop: "12px",
                      textAlign: "center",
                    }}
                  >
                    🕒 Voted on: {currentVoter?.votedAt}
                  </div>
                  {currentVoter?.receiptCode && (
                    <a
                      href={`${window.location.origin}/?verify=${currentVoter.receiptCode}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                        color: "#2563eb",
                        textDecoration: "none",
                        marginTop: "12px",
                      }}
                    >
                      Verify this receipt <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
                  {votingData?.config.thankYouMessage}
                </p>
              </div>
            ) : voterStatus === "closed" ? (
              <div
                style={{
                  backgroundColor: "white",
                  padding: "32px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  textAlign: "center",
                  width: "100%",
                }}
              >
                <Lock
                  size={48}
                  style={{ color: "#ef4444", margin: "0 auto 16px auto" }}
                />
                <h1
                  style={{
                    color: "#0f172a",
                    marginBottom: "8px",
                    fontSize: "24px",
                    fontWeight: "bold",
                  }}
                >
                  Election Closed
                </h1>
                <p style={{ color: "#64748b", lineHeight: "1.6" }}>
                  Voting for this election has ended.
                </p>
              </div>
            ) : voterStatus === "paused" ? (
              <div
                style={{
                  backgroundColor: "white",
                  padding: "32px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  textAlign: "center",
                  width: "100%",
                }}
              >
                <Pause
                  size={48}
                  style={{ color: "#f59e0b", margin: "0 auto 16px auto" }}
                />
                <h1
                  style={{
                    color: "#0f172a",
                    marginBottom: "8px",
                    fontSize: "24px",
                    fontWeight: "bold",
                  }}
                >
                  Voting Temporarily Paused
                </h1>
                <p style={{ color: "#64748b", lineHeight: "1.6" }}>
                  The HKGBC administrator has temporarily paused this election.
                  Please check back later.
                </p>
              </div>
            ) : voterStatus === "early" ? (
              <div
                style={{
                  backgroundColor: "white",
                  padding: "32px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  textAlign: "center",
                  width: "100%",
                }}
              >
                <Clock
                  size={48}
                  style={{ color: "#f59e0b", margin: "0 auto 16px auto" }}
                />
                <h1
                  style={{
                    color: "#0f172a",
                    marginBottom: "8px",
                    fontSize: "24px",
                    fontWeight: "bold",
                  }}
                >
                  Voting Has Not Started
                </h1>
                <p style={{ color: "#64748b", lineHeight: "1.6" }}>
                  Voting is scheduled to open on:
                </p>
                <p
                  style={{
                    color: "#0f172a",
                    fontWeight: "bold",
                    fontSize: "16px",
                    backgroundColor: "#f8fafc",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    marginTop: "8px",
                  }}
                >
                  {new Date(
                    parseLocalTime(votingData?.config.startTime || "") || ""
                  ).toLocaleString("en-HK", {
                    dateStyle: "full",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            ) : (
              <>
                {voterStep === 1 && (
                  <div
                    style={{
                      width: "100%",
                      backgroundColor: "white",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
                      padding: "32px",
                    }}
                  >
                    <div
                      style={{
                        marginBottom: "24px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        textAlign: "center",
                      }}
                    >
                      <HKGBCLogo height={64} />
                      <h1
                        style={{
                          fontSize: "20px",
                          fontWeight: "bold",
                          margin: "16px 0 4px 0",
                        }}
                      >
                        {votingData?.config.electionTitle}
                      </h1>
                      <p
                        style={{
                          color: "#64748b",
                          fontSize: "14px",
                          margin: 0,
                        }}
                      >
                        {votingData?.config.loginSubtitle ||
                          "Sign in to access your ballot"}
                      </p>
                    </div>
                    <form
                      onSubmit={handleVoterLogin}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px",
                      }}
                    >
                      {!urlToken && (
                        <div>
                          <label
                            style={{
                              display: "block",
                              fontSize: "14px",
                              fontWeight: 500,
                              color: "#334155",
                              marginBottom: "6px",
                            }}
                          >
                            Access Key
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. HKGBC-XXX-XXX"
                            value={voterKeyInput}
                            onChange={(e) => setVoterKeyInput(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "10px 12px",
                              backgroundColor: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              borderRadius: "8px",
                              fontSize: "14px",
                              outline: "none",
                              boxSizing: "border-box",
                              fontFamily: "inherit",
                            }}
                            required
                          />
                        </div>
                      )}
                      <div
                        style={{
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          padding: "16px",
                          marginBottom: "8px",
                          marginTop: "8px",
                        }}
                      >
                        <p
                          style={{
                            fontSize: "14px",
                            color: "#334155",
                            lineHeight: "1.6",
                            margin: 0,
                          }}
                        >
                          {votingData?.config.acknowledgmentText}
                        </p>
                      </div>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "12px",
                          cursor: "pointer",
                          marginBottom: "8px",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={acknowledged}
                          onChange={() => setAcknowledged(!acknowledged)}
                          style={{ marginTop: "4px" }}
                        />
                        <span style={{ fontSize: "14px", color: "#334155" }}>
                          I confirm my identity and acknowledge the rules.
                        </span>
                      </label>
                      {voterError && (
                        <p
                          style={{
                            fontSize: "14px",
                            color: "#ef4444",
                            margin: 0,
                          }}
                        >
                          {voterError}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={
                          urlToken ? handleAcknowledge : handleVoterLogin
                        }
                        disabled={!acknowledged}
                        style={{
                          width: "100%",
                          padding: "10px",
                          backgroundColor: acknowledged ? "#0F172A" : "#f1f5f9",
                          color: acknowledged ? "white" : "#94a3b8",
                          border: "none",
                          borderRadius: "8px",
                          fontWeight: 500,
                          fontSize: "14px",
                          cursor: acknowledged ? "pointer" : "not-allowed",
                          marginTop: "4px",
                          fontFamily: "inherit",
                        }}
                      >
                        {urlToken ? "Continue to Ballot" : "Sign in"}
                      </button>
                    </form>
                  </div>
                )}

                {voterStep === 2 && votingData && (
                  <div
                    style={{
                      width: "100%",
                      maxWidth: "600px",
                      backgroundColor: "white",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: "#f8fafc",
                        borderBottom: "1px solid #e2e8f0",
                        padding: "24px",
                      }}
                    >
                      <h2
                        style={{
                          fontSize: "18px",
                          fontWeight: "bold",
                          margin: "0 0 4px 0",
                        }}
                      >
                        {votingData.config.subsectorName}
                      </h2>
                      <p
                        style={{
                          fontSize: "14px",
                          color: "#64748b",
                          margin: "0 0 12px 0",
                        }}
                      >
                        {votingData.config.instructionsText}
                      </p>
                      <div
                        style={{
                          display: "inline-block",
                          backgroundColor: "#e2e8f0",
                          color: "#334155",
                          padding: "4px 12px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: "bold",
                        }}
                      >
                        {selectedIds.length} Selected
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "24px",
                      }}
                    >
                      {votingData.positions?.map((pos) => {
                        const posCandidates = votingData.candidates.filter(
                          (c) => c.positionId === pos.id
                        );
                        if (posCandidates.length === 0) return null;
                        return (
                          <div
                            key={pos.id}
                            style={{
                              border: "1px solid #e2e8f0",
                              borderRadius: "8px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                backgroundColor: "#f1f5f9",
                                padding: "12px 16px",
                                borderBottom: "1px solid #e2e8f0",
                                display: "flex",
                                flexDirection: "column",
                                gap: "4px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: "bold",
                                    color: "#0f172a",
                                  }}
                                >
                                  {pos.title}
                                </div>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    backgroundColor: "#e2e8f0",
                                    padding: "2px 8px",
                                    borderRadius: "4px",
                                    color: "#475569",
                                  }}
                                >
                                  Select up to {pos.maxSelections}
                                </div>
                              </div>
                              {pos.description && (
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "#64748b",
                                    fontStyle: "italic",
                                  }}
                                >
                                  {pos.description}
                                </div>
                              )}
                            </div>
                            <div
                              style={{
                                padding: "12px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "8px",
                              }}
                            >
                              {posCandidates.map((c) => {
                                const isSelected = selectedIds.includes(c.id);
                                return (
                                  <div
                                    key={c.id}
                                    onClick={() =>
                                      toggleCandidateSelection(c.id, pos.id)
                                    }
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "16px",
                                      padding: "16px",
                                      borderRadius: "8px",
                                      border: `1px solid ${
                                        isSelected ? "#0f172a" : "#e2e8f0"
                                      }`,
                                      backgroundColor: isSelected
                                        ? "#f8fafc"
                                        : "white",
                                      cursor: "pointer",
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: "20px",
                                        height: "20px",
                                        borderRadius: "4px",
                                        border: `1px solid ${
                                          isSelected ? "#0f172a" : "#cbd5e1"
                                        }`,
                                        backgroundColor: isSelected
                                          ? "#0f172a"
                                          : "white",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                      }}
                                    >
                                      {isSelected && (
                                        <Check
                                          style={{
                                            width: "14px",
                                            height: "14px",
                                            color: "white",
                                          }}
                                        />
                                      )}
                                    </div>
                                    {c.imageUrl ? (
                                      <img
                                        src={c.imageUrl}
                                        style={{
                                          width: "40px",
                                          height: "40px",
                                          borderRadius: "50%",
                                          objectFit: "cover",
                                          flexShrink: 0,
                                        }}
                                      />
                                    ) : (
                                      <div
                                        style={{
                                          width: "40px",
                                          height: "40px",
                                          borderRadius: "50%",
                                          backgroundColor: "#f1f5f9",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          fontWeight: "bold",
                                          color: "#475569",
                                          flexShrink: 0,
                                        }}
                                      >
                                        {c.name.charAt(0)}
                                      </div>
                                    )}
                                    <div>
                                      <div
                                        style={{
                                          fontWeight: 500,
                                          color: "#0f172a",
                                        }}
                                      >
                                        {c.name}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: "14px",
                                          color: "#64748b",
                                        }}
                                      >
                                        {c.title}
                                      </div>
                                      {c.infoUrl && (
                                        <a
                                          href={c.infoUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          style={{
                                            fontSize: "12px",
                                            color: "#2563eb",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            marginTop: "4px",
                                            textDecoration: "none",
                                          }}
                                        >
                                          Learn more <ExternalLink size={12} />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div
                      style={{
                        padding: "16px",
                        borderTop: "1px solid #e2e8f0",
                      }}
                    >
                      <button
                        onClick={() => {
                          if (selectedIds.length > 0) setVoterStep(3);
                        }}
                        style={{
                          width: "100%",
                          padding: "10px",
                          backgroundColor: "#0F172A",
                          color: "white",
                          border: "none",
                          borderRadius: "8px",
                          fontWeight: 500,
                          fontSize: "14px",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        Review Selections
                      </button>
                    </div>
                  </div>
                )}

                {voterStep === 3 && votingData && (
                  <div
                    style={{
                      width: "100%",
                      backgroundColor: "white",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
                      padding: "32px",
                    }}
                  >
                    <h1
                      style={{
                        fontSize: "24px",
                        fontWeight: "bold",
                        marginBottom: "8px",
                      }}
                    >
                      Review Ballot
                    </h1>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#64748b",
                        marginBottom: "24px",
                      }}
                    >
                      Once submitted, your vote is final.
                    </p>
                    <div
                      style={{
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        padding: "16px",
                        marginBottom: "24px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px",
                      }}
                    >
                      {votingData.positions?.map((pos) => {
                        const names = selectedIds
                          .map((id) =>
                            votingData.candidates.find((c) => c.id === id)
                          )
                          .filter((c) => c?.positionId === pos.id && c)
                          .map((c) => c?.name);
                        if (names.length === 0) return null;
                        return (
                          <div key={pos.id}>
                            <div
                              style={{
                                fontSize: "12px",
                                fontWeight: "bold",
                                color: "#64748b",
                                marginBottom: "8px",
                                textTransform: "uppercase",
                              }}
                            >
                              {pos.title}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "8px",
                              }}
                            >
                              {names.map((n, i) => (
                                <div
                                  key={i}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    fontSize: "14px",
                                    fontWeight: 500,
                                    color: "#1e293b",
                                  }}
                                >
                                  <Check
                                    style={{
                                      width: "16px",
                                      height: "16px",
                                      color: "#0f172a",
                                    }}
                                  />{" "}
                                  {n}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setIsSubmitConfirmOpen(true)}
                      disabled={isSubmittingVote}
                      style={{
                        width: "100%",
                        padding: "10px",
                        backgroundColor: isSubmittingVote
                          ? "#64748b"
                          : "#0F172A",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: 500,
                        fontSize: "14px",
                        cursor: isSubmittingVote ? "not-allowed" : "pointer",
                        marginBottom: "12px",
                        fontFamily: "inherit",
                      }}
                    >
                      {isSubmittingVote ? "Submitting..." : "Confirm & Submit"}
                    </button>
                    <button
                      onClick={() => setVoterStep(2)}
                      disabled={isSubmittingVote}
                      style={{
                        width: "100%",
                        padding: "10px",
                        backgroundColor: "white",
                        color: "#334155",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        fontWeight: 500,
                        fontSize: "14px",
                        cursor: isSubmittingVote ? "not-allowed" : "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Back to Edit
                    </button>
                  </div>
                )}

                {voterStep === 5 && votingData && (
                  <div
                    style={{
                      width: "100%",
                      backgroundColor: "white",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
                      padding: "32px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        width: "64px",
                        height: "64px",
                        backgroundColor: "#ecfdf5",
                        color: "#10b981",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 16px auto",
                      }}
                    >
                      <CheckCircle2 size={32} />
                    </div>
                    <h1
                      style={{
                        fontSize: "24px",
                        fontWeight: "bold",
                        marginBottom: "8px",
                      }}
                    >
                      Vote Recorded
                    </h1>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#64748b",
                        marginBottom: "32px",
                      }}
                    >
                      {votingData.config.thankYouMessage}
                    </p>
                    <div
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        padding: "20px",
                        textAlign: "left",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: "bold",
                          color: "#94a3b8",
                          textTransform: "uppercase",
                          marginBottom: "4px",
                        }}
                      >
                        Receipt Code
                      </div>
                      <div
                        style={{
                          fontFamily: "monospace",
                          fontSize: "20px",
                          fontWeight: "bold",
                          color: "#0f172a",
                          backgroundColor: "#f8fafc",
                          padding: "12px",
                          borderRadius: "4px",
                          border: "1px solid #f1f5f9",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        {receiptId}
                        <button
                          onClick={() => safeCopyText(receiptId, "receipt")}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "#94a3b8",
                          }}
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#94a3b8",
                          marginTop: "8px",
                          textAlign: "center",
                        }}
                      >
                        🕒 {receiptTime}
                      </div>
                      <div style={{ marginTop: "16px" }}>
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: "bold",
                            color: "#94a3b8",
                            textTransform: "uppercase",
                            marginBottom: "6px",
                          }}
                        >
                          Your Selections
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                            fontSize: "14px",
                            color: "#1e293b",
                          }}
                        >
                          {receiptSelections.map((id) => {
                            const c = votingData.candidates.find(
                              (x) => x.id === id
                            );
                            return c ? (
                              <div
                                key={id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <Check
                                  style={{
                                    width: "14px",
                                    height: "14px",
                                    color: "#059669",
                                  }}
                                />{" "}
                                {c.name}
                              </div>
                            ) : null;
                          })}
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#94a3b8",
                            fontFamily: "monospace",
                            marginTop: "8px",
                          }}
                        >
                          Hash:{" "}
                          {makeReceiptHash(
                            receiptId,
                            receiptSelections,
                            receiptTime
                          )}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: "24px",
                        padding: "16px",
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "13px",
                          color: "#475569",
                          margin: 0,
                          lineHeight: 1.5,
                        }}
                      >
                        Please <strong>download, print, or screenshot</strong>{" "}
                        this receipt and keep it for your records. You will need
                        this code if you wish to verify your vote in the future.
                      </p>
                    </div>
                    <button
                      onClick={printReceipt}
                      style={{
                        marginTop: "16px",
                        width: "100%",
                        padding: "10px",
                        backgroundColor: "white",
                        color: "#0F172A",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        fontWeight: 500,
                        fontSize: "14px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        fontFamily: "inherit",
                      }}
                    >
                      <Printer size={16} /> Print / Save Receipt
                    </button>
                    <a
                      href={`${window.location.origin}/?verify=${receiptId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        marginTop: "10px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                        color: "#2563eb",
                        textDecoration: "none",
                      }}
                    >
                      Verify this receipt <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 
          ============================================================
          Admin View
          ============================================================
        */}
        {!isPreviewActive && viewMode === "admin" && (
          <div style={{ width: "100%", maxWidth: "1000px" }}>
            {!isAdminAuth ? (
              <div
                style={{
                  width: "100%",
                  maxWidth: "440px",
                  margin: "0 auto",
                  backgroundColor: "white",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
                  padding: "32px",
                }}
              >
                <div
                  style={{
                    marginBottom: "24px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                  }}
                >
                  <HKGBCLogo height={64} />
                  <h1
                    style={{
                      fontSize: "24px",
                      fontWeight: "bold",
                      margin: "16px 0 4px 0",
                    }}
                  >
                    Admin Access
                  </h1>
                  <p style={{ color: "#64748b", fontSize: "15px", margin: 0 }}>
                    Sign in to manage your elections
                  </p>
                </div>
                <form
                  onSubmit={handleAdminLogin}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "14px",
                        fontWeight: 500,
                        color: "#334155",
                        marginBottom: "6px",
                      }}
                    >
                      Admin Password
                    </label>
                    <input
                      type="password"
                      placeholder="Enter admin password"
                      value={adminPassInput}
                      onChange={(e) => setAdminPassInput(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        fontSize: "14px",
                        outline: "none",
                        boxSizing: "border-box",
                        fontFamily: "inherit",
                      }}
                      required
                    />
                  </div>
                  {adminError && (
                    <p
                      style={{ fontSize: "14px", color: "#ef4444", margin: 0 }}
                    >
                      {adminError}
                    </p>
                  )}
                  <button
                    type="submit"
                    style={{
                      width: "100%",
                      padding: "10px",
                      backgroundColor: "#0F172A",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      fontWeight: 500,
                      fontSize: "14px",
                      cursor: "pointer",
                      marginTop: "4px",
                      fontFamily: "inherit",
                    }}
                  >
                    Sign in
                  </button>
                </form>
              </div>
            ) : (
              <div>
                {!activeElectionId ? (
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "24px",
                        flexWrap: "wrap",
                        gap: "12px",
                      }}
                    >
                      <div>
                        <h1
                          style={{
                            fontSize: "24px",
                            fontWeight: "bold",
                            margin: 0,
                          }}
                        >
                          Your Elections
                        </h1>
                        <p
                          style={{
                            color: "#64748b",
                            fontSize: "14px",
                            margin: 0,
                          }}
                        >
                          Manage all active and past elections.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const newEl = createNewElection();
                          saveToFirestore(newEl);
                          setActiveElectionId(newEl.config.id);
                          setAdminTab("settings");
                        }}
                        style={{
                          padding: "10px 16px",
                          backgroundColor: "#0F172A",
                          color: "white",
                          border: "none",
                          borderRadius: "8px",
                          fontWeight: 500,
                          fontSize: "14px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontFamily: "inherit",
                        }}
                      >
                        <Plus size={18} /> Create New Election
                      </button>
                    </div>
                    {dbState.length === 0 ? (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "64px",
                          backgroundColor: "white",
                          borderRadius: "12px",
                          border: "1px dashed #cbd5e1",
                        }}
                      >
                        <h3 style={{ color: "#64748b", marginBottom: "8px" }}>
                          No elections yet
                        </h3>
                        <p style={{ color: "#94a3b8", fontSize: "14px" }}>
                          Click "Create New Election" to get started.
                        </p>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fill, minmax(300px, 1fr))",
                          gap: "16px",
                        }}
                      >
                        {dbState.map((el) => {
                          const { isHardEnded, isPaused, isLaunched } =
                            el.config;
                          let cardStatus = isHardEnded
                            ? "ENDED"
                            : isPaused
                            ? "PAUSED"
                            : isLaunched
                            ? "ACTIVE"
                            : "DRAFT";
                          let cardBg = isHardEnded
                            ? "#f1f5f9"
                            : isPaused
                            ? "#fef3c7"
                            : isLaunched
                            ? "#dcfce7"
                            : "#f1f5f9";
                          let cardText = isHardEnded
                            ? "#64748b"
                            : isPaused
                            ? "#92400e"
                            : isLaunched
                            ? "#15803d"
                            : "#64748b";
                          return (
                            <div
                              key={el.config.id}
                              style={{
                                backgroundColor: "white",
                                border: "1px solid #e2e8f0",
                                borderRadius: "12px",
                                padding: "20px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "12px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "flex-start",
                                  gap: "8px",
                                }}
                              >
                                <h3
                                  style={{
                                    margin: 0,
                                    fontSize: "18px",
                                    fontWeight: "bold",
                                    color: "#0f172a",
                                  }}
                                >
                                  {el.config.electionTitle}
                                </h3>
                                <span
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: "bold",
                                    padding: "4px 8px",
                                    borderRadius: "4px",
                                    backgroundColor: cardBg,
                                    color: cardText,
                                    flexShrink: 0,
                                  }}
                                >
                                  {cardStatus}
                                </span>
                              </div>
                              <p
                                style={{
                                  fontSize: "12px",
                                  color: "#94a3b8",
                                  margin: 0,
                                }}
                              >
                                Created: {el.config.createdAt}
                              </p>
                              <div
                                style={{
                                  display: "flex",
                                  gap: "16px",
                                  fontSize: "13px",
                                  color: "#475569",
                                  backgroundColor: "#f8fafc",
                                  padding: "12px",
                                  borderRadius: "8px",
                                  flexWrap: "wrap",
                                }}
                              >
                                <div>
                                  <strong>{el.positions?.length || 0}</strong>{" "}
                                  Positions
                                </div>
                                <div>
                                  <strong>{el.candidates.length}</strong>{" "}
                                  Candidates
                                </div>
                                <div>
                                  <strong>{el.voters.length}</strong> Voters
                                </div>
                                <div>
                                  <strong>
                                    {el.votes.filter((v) => !v.isVoided).length}
                                  </strong>{" "}
                                  Votes Cast
                                </div>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  gap: "8px",
                                  marginTop: "auto",
                                }}
                              >
                                <button
                                  onClick={() => {
                                    setActiveElectionId(el.config.id);
                                    setAdminTab("results");
                                  }}
                                  style={{
                                    flex: 1,
                                    padding: "8px",
                                    backgroundColor: "#f1f5f9",
                                    color: "#0f172a",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "6px",
                                    fontWeight: 500,
                                    fontSize: "14px",
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                  }}
                                >
                                  Manage
                                </button>
                                <button
                                  onClick={() => deleteElection(el.config.id)}
                                  style={{
                                    padding: "8px 12px",
                                    backgroundColor: "#fff1f2",
                                    color: "#e11d48",
                                    border: "1px solid #fecdd3",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    fontFamily: "inherit",
                                  }}
                                  title="Delete Election"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      backgroundColor: "white",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
                      overflow: "hidden",
                      minHeight: "600px",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div
                      style={{
                        borderBottom: "1px solid #e2e8f0",
                        padding: "24px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        backgroundColor: "#f8fafc",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "16px",
                        }}
                      >
                        <button
                          onClick={() => {
                            setActiveElectionId(null);
                            setEditingCandidateId(null);
                          }}
                          style={{
                            padding: "8px",
                            backgroundColor: "white",
                            border: "1px solid #cbd5e1",
                            borderRadius: "8px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            fontFamily: "inherit",
                          }}
                        >
                          <ArrowLeft size={16} />
                        </button>
                        <div>
                          <h2
                            style={{
                              fontSize: "20px",
                              fontWeight: "bold",
                              margin: "0 0 4px 0",
                            }}
                          >
                            {activeData?.config.electionTitle}
                          </h2>
                          <p
                            style={{
                              fontSize: "14px",
                              color: "#64748b",
                              margin: 0,
                            }}
                          >
                            Manage candidates, voters, and settings
                          </p>
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        borderBottom: "1px solid #e2e8f0",
                        padding: "0 24px",
                        paddingTop: "8px",
                        overflowX: "auto",
                      }}
                    >
                      <button
                        onClick={() => setAdminTab("results")}
                        style={{
                          padding: "12px 16px",
                          fontSize: "14px",
                          fontWeight: 500,
                          border: "none",
                          borderBottom: `2px solid ${
                            adminTab === "results" ? "#0f172a" : "transparent"
                          }`,
                          color: adminTab === "results" ? "#0f172a" : "#64748b",
                          backgroundColor: "transparent",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          fontFamily: "inherit",
                        }}
                      >
                        <BarChart
                          size={16}
                          style={{
                            display: "inline",
                            marginRight: "6px",
                            verticalAlign: "text-bottom",
                          }}
                        />{" "}
                        Live Results
                      </button>
                      <button
                        onClick={() => setAdminTab("voters")}
                        style={{
                          padding: "12px 16px",
                          fontSize: "14px",
                          fontWeight: 500,
                          border: "none",
                          borderBottom: `2px solid ${
                            adminTab === "voters" ? "#0f172a" : "transparent"
                          }`,
                          color: adminTab === "voters" ? "#0f172a" : "#64748b",
                          backgroundColor: "transparent",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          fontFamily: "inherit",
                        }}
                      >
                        <Users
                          size={16}
                          style={{
                            display: "inline",
                            marginRight: "6px",
                            verticalAlign: "text-bottom",
                          }}
                        />{" "}
                        Voters ({activeData?.voters.length})
                      </button>
                      <button
                        onClick={() => {
                          setAdminTab("candidates");
                          setEditingCandidateId(null);
                          setCandName("");
                          setCandTitle("");
                          setCandImage(undefined);
                          setCandInfoUrl("");
                        }}
                        style={{
                          padding: "12px 16px",
                          fontSize: "14px",
                          fontWeight: 500,
                          border: "none",
                          borderBottom: `2px solid ${
                            adminTab === "candidates"
                              ? "#0f172a"
                              : "transparent"
                          }`,
                          color:
                            adminTab === "candidates" ? "#0f172a" : "#64748b",
                          backgroundColor: "transparent",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          fontFamily: "inherit",
                        }}
                      >
                        <Users
                          size={16}
                          style={{
                            display: "inline",
                            marginRight: "6px",
                            verticalAlign: "text-bottom",
                          }}
                        />{" "}
                        Candidates (
                        {activeData?.candidates?.filter((c) =>
                          activeData.positions.some(
                            (p) => p.id === c.positionId
                          )
                        ).length || 0}
                        )
                      </button>
                      <button
                        onClick={() => setAdminTab("settings")}
                        style={{
                          padding: "12px 16px",
                          fontSize: "14px",
                          fontWeight: 500,
                          border: "none",
                          borderBottom: `2px solid ${
                            adminTab === "settings" ? "#0f172a" : "transparent"
                          }`,
                          color:
                            adminTab === "settings" ? "#0f172a" : "#64748b",
                          backgroundColor: "transparent",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          fontFamily: "inherit",
                        }}
                      >
                        <Settings
                          size={16}
                          style={{
                            display: "inline",
                            marginRight: "6px",
                            verticalAlign: "text-bottom",
                          }}
                        />{" "}
                        Settings
                      </button>
                    </div>

                    <div style={{ padding: "32px", flex: 1 }}>
                      {adminTab === "results" &&
                        activeData &&
                        (() => {
                          const isEnded =
                            activeData.config.isHardEnded ||
                            (!activeData.config.isLaunched &&
                              !!activeData.config.startTime) ||
                            (!!activeData.config.endTime &&
                              currentTime.getTime() >
                                parseLocalTime(activeData.config.endTime)!);
                          const isSealed =
                            activeData.config.sealResults && !isEnded;
                          if (isSealed) {
                            return (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  padding: "64px",
                                  backgroundColor: "#f8fafc",
                                  borderRadius: "12px",
                                  border: "1px dashed #cbd5e1",
                                }}
                              >
                                <Lock
                                  size={48}
                                  style={{
                                    color: "#64748b",
                                    marginBottom: "16px",
                                  }}
                                />
                                <h2
                                  style={{
                                    fontSize: "20px",
                                    fontWeight: "bold",
                                    color: "#0f172a",
                                    marginBottom: "8px",
                                  }}
                                >
                                  Results are Sealed
                                </h2>
                                <p
                                  style={{
                                    fontSize: "14px",
                                    color: "#64748b",
                                    textAlign: "center",
                                    maxWidth: "400px",
                                  }}
                                >
                                  The results are sealed to guarantee a fair
                                  election. They will be revealed automatically
                                  once the election officially ends.
                                </p>
                              </div>
                            );
                          }
                          const resultsByPosition =
                            activeData.positions?.map((pos) => {
                              const candidatesForPos = activeData.candidates
                                .filter((c) => c.positionId === pos.id)
                                .map((c) => ({
                                  ...c,
                                  count: activeData.votes.filter(
                                    (v) =>
                                      !v.isVoided &&
                                      v.selectedCandidateIds.includes(c.id)
                                  ).length,
                                }))
                                .sort((a, b) => b.count - a.count);
                              const maxVotes =
                                candidatesForPos.length > 0
                                  ? candidatesForPos[0].count
                                  : 0;
                              const winners = candidatesForPos.filter(
                                (c) => c.count === maxVotes && maxVotes > 0
                              );
                              const isTie = winners.length > 1;
                              return {
                                pos,
                                candidates: candidatesForPos,
                                maxVotes,
                                isTie,
                              };
                            }) || [];
                          const validVoteCount = activeData.votes.filter(
                            (v) => !v.isVoided
                          ).length;
                          return (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "24px",
                                maxWidth: "700px",
                              }}
                            >
                              {isEnded && (
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "flex-end",
                                    gap: "8px",
                                  }}
                                >
                                  <button
                                    onClick={() => {
                                      if (!activeData) return;
                                      const csvRows = [
                                        [
                                          "Position",
                                          "Rank",
                                          "Candidate Name",
                                          "Votes",
                                          "Percentage",
                                        ],
                                      ];
                                      resultsByPosition.forEach(
                                        ({ pos, candidates }) => {
                                          candidates.forEach((c, i) => {
                                            const pct =
                                              validVoteCount > 0
                                                ? Math.round(
                                                    (c.count / validVoteCount) *
                                                      100
                                                  )
                                                : 0;
                                            csvRows.push([
                                              `"${pos.title}"`,
                                              (i + 1).toString(),
                                              `"${c.name}"`,
                                              c.count.toString(),
                                              `${pct}%`,
                                            ]);
                                          });
                                        }
                                      );
                                      const csvContent =
                                        "\uFEFF" +
                                        csvRows
                                          .map((e) => e.join(","))
                                          .join("\n");
                                      const blob = new Blob([csvContent], {
                                        type: "text/csv;charset=utf-8;",
                                      });
                                      const url = URL.createObjectURL(blob);
                                      const link = document.createElement("a");
                                      link.href = url;
                                      link.setAttribute(
                                        "download",
                                        `Election_Results_${activeData.config.id}.csv`
                                      );
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                    }}
                                    style={{
                                      padding: "8px 16px",
                                      backgroundColor: "#059669",
                                      color: "white",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                      borderRadius: "8px",
                                      fontSize: "14px",
                                      fontWeight: "bold",
                                      cursor: "pointer",
                                      fontFamily: "inherit",
                                    }}
                                  >
                                    <Download size={16} /> Export Results (CSV)
                                  </button>
                                  <button
                                    onClick={downloadResultsImage}
                                    style={{
                                      padding: "8px 16px",
                                      backgroundColor: "#0f172a",
                                      color: "white",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                      borderRadius: "8px",
                                      fontSize: "14px",
                                      fontWeight: "bold",
                                      cursor: "pointer",
                                      fontFamily: "inherit",
                                    }}
                                  >
                                    <FileImage size={16} /> Download Image
                                  </button>
                                </div>
                              )}
                              <div
                                style={{
                                  padding: "32px",
                                  backgroundColor: "white",
                                  borderRadius: "16px",
                                  border: "1px solid #e2e8f0",
                                  boxShadow:
                                    "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "16px",
                                    borderBottom: "2px solid #f1f5f9",
                                    paddingBottom: "16px",
                                    marginBottom: "24px",
                                  }}
                                >
                                  <HKGBCLogo height={48} />
                                  <div>
                                    <h2
                                      style={{
                                        fontSize: "22px",
                                        fontWeight: "bold",
                                        margin: 0,
                                        color: "#0f172a",
                                      }}
                                    >
                                      {activeData.config.electionTitle}
                                    </h2>
                                    <p
                                      style={{
                                        fontSize: "14px",
                                        color: "#64748b",
                                        margin: "4px 0 0 0",
                                      }}
                                    >
                                      {activeData.config.subsectorName}
                                    </p>
                                  </div>
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "16px",
                                    marginBottom: "24px",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <div
                                    style={{
                                      backgroundColor: "#f8fafc",
                                      padding: "16px",
                                      borderRadius: "12px",
                                      flex: 1,
                                      minWidth: "150px",
                                      border: "1px solid #e2e8f0",
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: "12px",
                                        textTransform: "uppercase",
                                        color: "#64748b",
                                        fontWeight: "bold",
                                      }}
                                    >
                                      Valid Ballots Cast
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "24px",
                                        fontWeight: "bold",
                                        color: "#0f172a",
                                      }}
                                    >
                                      {validVoteCount}
                                    </div>
                                  </div>
                                  <div
                                    style={{
                                      backgroundColor: "#f8fafc",
                                      padding: "16px",
                                      borderRadius: "12px",
                                      flex: 1,
                                      minWidth: "150px",
                                      border: "1px solid #e2e8f0",
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: "12px",
                                        textTransform: "uppercase",
                                        color: "#64748b",
                                        fontWeight: "bold",
                                      }}
                                    >
                                      Voter Turnout
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "24px",
                                        fontWeight: "bold",
                                        color: "#0f172a",
                                      }}
                                    >
                                      {activeData.voters.length > 0
                                        ? Math.round(
                                            (activeData.voters.filter(
                                              (v) => v.hasVoted
                                            ).length /
                                              activeData.voters.length) *
                                              100
                                          )
                                        : 0}
                                      %
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "12px",
                                        color: "#64748b",
                                        marginTop: "4px",
                                      }}
                                    >
                                      {
                                        activeData.voters.filter(
                                          (v) => v.hasVoted
                                        ).length
                                      }{" "}
                                      voted /{" "}
                                      {
                                        activeData.voters.filter(
                                          (v) => !v.hasVoted
                                        ).length
                                      }{" "}
                                      pending (Total: {activeData.voters.length}
                                      )
                                    </div>
                                  </div>
                                  <div
                                    style={{
                                      backgroundColor: "#f8fafc",
                                      padding: "16px",
                                      borderRadius: "12px",
                                      flex: 1,
                                      minWidth: "150px",
                                      border: "1px solid #e2e8f0",
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: "12px",
                                        textTransform: "uppercase",
                                        color: "#64748b",
                                        fontWeight: "bold",
                                      }}
                                    >
                                      Total Positions
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "24px",
                                        fontWeight: "bold",
                                        color: "#0f172a",
                                      }}
                                    >
                                      {activeData.positions?.length || 0}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "12px",
                                        color: "#64748b",
                                        marginTop: "4px",
                                      }}
                                    >
                                      Being elected
                                    </div>
                                  </div>
                                  <div
                                    style={{
                                      backgroundColor: "#f8fafc",
                                      padding: "16px",
                                      borderRadius: "12px",
                                      flex: 1,
                                      minWidth: "150px",
                                      border: "1px solid #e2e8f0",
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: "12px",
                                        textTransform: "uppercase",
                                        color: "#64748b",
                                        fontWeight: "bold",
                                      }}
                                    >
                                      Status
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "24px",
                                        fontWeight: "bold",
                                        color: isEnded ? "#059669" : "#f59e0b",
                                      }}
                                    >
                                      {isEnded ? "FINAL" : "LIVE"}
                                    </div>
                                  </div>
                                </div>
                                {resultsByPosition.map(
                                  ({ pos, candidates, maxVotes, isTie }) => (
                                    <div
                                      key={pos.id}
                                      style={{ marginBottom: "32px" }}
                                    >
                                      <h3
                                        style={{
                                          fontSize: "18px",
                                          fontWeight: "bold",
                                          margin: "0 0 16px 0",
                                          color: "#0f172a",
                                          borderBottom: "1px solid #e2e8f0",
                                          paddingBottom: "8px",
                                        }}
                                      >
                                        {pos.title}
                                      </h3>
                                      {isTie && (
                                        <div
                                          style={{
                                            backgroundColor: "#fef2f2",
                                            border: "1px solid #fecaca",
                                            padding: "12px",
                                            borderRadius: "8px",
                                            marginBottom: "16px",
                                            display: "flex",
                                            gap: "12px",
                                            alignItems: "flex-start",
                                          }}
                                        >
                                          <AlertTriangle
                                            style={{
                                              color: "#dc2626",
                                              marginTop: "2px",
                                              flexShrink: 0,
                                            }}
                                            size={18}
                                          />
                                          <div>
                                            <h4
                                              style={{
                                                margin: 0,
                                                fontSize: "13px",
                                                fontWeight: "bold",
                                                color: "#991b1b",
                                              }}
                                            >
                                              Tie Detected for {pos.title}!
                                            </h4>
                                          </div>
                                        </div>
                                      )}
                                      <div
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: "12px",
                                        }}
                                      >
                                        {candidates.map((c, idx) => {
                                          const isWinner =
                                            maxVotes > 0 &&
                                            c.count === maxVotes &&
                                            idx < pos.maxSelections;
                                          const pct =
                                            validVoteCount > 0
                                              ? Math.round(
                                                  (c.count / validVoteCount) *
                                                    100
                                                )
                                              : 0;
                                          return (
                                            <div
                                              key={c.id}
                                              style={{
                                                padding: "12px 16px",
                                                borderRadius: "12px",
                                                backgroundColor: isWinner
                                                  ? "#ecfdf5"
                                                  : "#f8fafc",
                                                border: `1px solid ${
                                                  isWinner
                                                    ? "#a7f3d0"
                                                    : "#e2e8f0"
                                                }`,
                                              }}
                                            >
                                              <div
                                                style={{
                                                  display: "flex",
                                                  justifyContent:
                                                    "space-between",
                                                  alignItems: "center",
                                                  marginBottom: "8px",
                                                  gap: "8px",
                                                  flexWrap: "wrap",
                                                }}
                                              >
                                                <div
                                                  style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "8px",
                                                  }}
                                                >
                                                  {isWinner ? (
                                                    <Trophy
                                                      size={16}
                                                      style={{
                                                        color: "#eab308",
                                                      }}
                                                    />
                                                  ) : (
                                                    <div
                                                      style={{ width: "16px" }}
                                                    />
                                                  )}
                                                  <span
                                                    style={{
                                                      fontWeight: isWinner
                                                        ? "bold"
                                                        : "normal",
                                                      color: isWinner
                                                        ? "#065f46"
                                                        : "#1e293b",
                                                      fontSize: "15px",
                                                    }}
                                                  >
                                                    {c.name}
                                                  </span>
                                                </div>
                                                <span
                                                  style={{
                                                    fontFamily: "monospace",
                                                    fontSize: "14px",
                                                    fontWeight: "bold",
                                                    color: isWinner
                                                      ? "#059669"
                                                      : "#64748b",
                                                  }}
                                                >
                                                  {c.count} votes ({pct}%)
                                                </span>
                                              </div>
                                              <div
                                                style={{
                                                  width: "100%",
                                                  backgroundColor: isWinner
                                                    ? "#d1fae5"
                                                    : "#e2e8f0",
                                                  borderRadius: "999px",
                                                  height: "8px",
                                                }}
                                              >
                                                <div
                                                  style={{
                                                    backgroundColor: isWinner
                                                      ? "#059669"
                                                      : "#94a3b8",
                                                    height: "8px",
                                                    borderRadius: "999px",
                                                    width: `${pct}%`,
                                                    transition:
                                                      "width 0.5s ease",
                                                  }}
                                                ></div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                              {!activeData.config.isSecretBallot && (
                                <div style={{ marginTop: "16px" }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                      marginBottom: "16px",
                                    }}
                                  >
                                    <Shield size={20} color="#e11d48" />
                                    <h3
                                      style={{
                                        fontSize: "18px",
                                        fontWeight: "bold",
                                        margin: 0,
                                      }}
                                    >
                                      Open Ballot Audit Trail
                                    </h3>
                                  </div>
                                  <p
                                    style={{
                                      fontSize: "14px",
                                      color: "#e11d48",
                                      marginBottom: "16px",
                                    }}
                                  >
                                    Because this is NOT a secret ballot, the
                                    votes are mapped to the voters below.
                                    (Voided ballots are shown with a
                                    strike-through).
                                  </p>
                                  <div
                                    style={{
                                      border: "1px solid #e2e8f0",
                                      borderRadius: "8px",
                                      overflowX: "auto",
                                    }}
                                  >
                                    <table
                                      style={{
                                        width: "100%",
                                        minWidth: "600px",
                                        textAlign: "left",
                                        fontSize: "14px",
                                        borderCollapse: "collapse",
                                      }}
                                    >
                                      <thead
                                        style={{
                                          backgroundColor: "#fff1f2",
                                          borderBottom: "1px solid #fecdd3",
                                        }}
                                      >
                                        <tr>
                                          <th
                                            style={{
                                              padding: "12px",
                                              fontWeight: 500,
                                            }}
                                          >
                                            Voter
                                          </th>
                                          <th
                                            style={{
                                              padding: "12px",
                                              fontWeight: 500,
                                            }}
                                          >
                                            Time
                                          </th>
                                          <th
                                            style={{
                                              padding: "12px",
                                              fontWeight: 500,
                                            }}
                                          >
                                            Voted For
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {activeData.votes.map((vote, idx) => {
                                          const voter = activeData.voters.find(
                                            (v) =>
                                              (vote.voterToken &&
                                                v.token === vote.voterToken) ||
                                              (v.receiptCode &&
                                                v.receiptCode ===
                                                  vote.receiptCode)
                                          );
                                          return (
                                            <tr
                                              key={idx}
                                              style={{
                                                borderBottom:
                                                  "1px solid #f1f5f9",
                                                backgroundColor: vote.isVoided
                                                  ? "#f8fafc"
                                                  : "transparent",
                                                opacity: vote.isVoided
                                                  ? 0.5
                                                  : 1,
                                              }}
                                            >
                                              <td style={{ padding: "12px" }}>
                                                <div
                                                  style={{
                                                    fontWeight: 500,
                                                    textDecoration:
                                                      vote.isVoided
                                                        ? "line-through"
                                                        : "none",
                                                  }}
                                                >
                                                  {voter?.voterName ||
                                                    "Unknown"}
                                                </div>
                                                <div
                                                  style={{
                                                    fontSize: "12px",
                                                    color: "#64748b",
                                                  }}
                                                >
                                                  {voter?.email}
                                                </div>
                                              </td>
                                              <td
                                                style={{
                                                  padding: "12px",
                                                  fontSize: "13px",
                                                  color: "#64748b",
                                                  textDecoration: vote.isVoided
                                                    ? "line-through"
                                                    : "none",
                                                }}
                                              >
                                                {vote.timestamp}
                                              </td>
                                              <td
                                                style={{
                                                  padding: "12px",
                                                  fontWeight: 500,
                                                  color: "#0f172a",
                                                  textDecoration: vote.isVoided
                                                    ? "line-through"
                                                    : "none",
                                                }}
                                              >
                                                {vote.selectedCandidateIds
                                                  .map((id) => {
                                                    const cand =
                                                      activeData.candidates.find(
                                                        (c) => c.id === id
                                                      );
                                                    return cand
                                                      ? cand.name
                                                      : "(Deleted Candidate)";
                                                  })
                                                  .join(", ")}
                                                {vote.isVoided && (
                                                  <span
                                                    style={{
                                                      marginLeft: "8px",
                                                      fontSize: "11px",
                                                      color: "#ef4444",
                                                      fontWeight: "bold",
                                                      textDecoration: "none",
                                                      display: "inline-block",
                                                    }}
                                                  >
                                                    (VOIDED)
                                                  </span>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                      {adminTab === "voters" && activeData && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "24px",
                            maxWidth: "900px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: "12px",
                              flexWrap: "wrap",
                              alignItems: "center",
                            }}
                          >
                            <button
                              onClick={() => csvInputRef.current?.click()}
                              disabled={isImporting}
                              style={{
                                padding: "8px 16px",
                                backgroundColor: "#eff6ff",
                                color: "#1d4ed8",
                                border: "1px solid #bfdbfe",
                                borderRadius: "6px",
                                fontSize: "14px",
                                fontWeight: 500,
                                cursor: isImporting ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                fontFamily: "inherit",
                                opacity: isImporting ? 0.6 : 1,
                              }}
                            >
                              <Upload size={16} />{" "}
                              {isImporting
                                ? "Importing..."
                                : "Import CSV (name, email)"}
                            </button>
                            <input
                              type="file"
                              accept=".csv,text/csv"
                              ref={csvInputRef}
                              onChange={handleCSVImport}
                              style={{ display: "none" }}
                            />
                            <button
                              onClick={() => {
                                if (!activeData) return;
                                const csvRows = [
                                  ["Name", "Email", "Status", "Voting Link"],
                                ];
                                activeData.voters.forEach((v) => {
                                  const link = `${window.location.origin}/?token=${v.token}&election=${activeData.config.id}`;
                                  csvRows.push([
                                    `"${v.voterName}"`,
                                    `"${v.email || ""}"`,
                                    v.hasVoted ? "Voted" : "Pending",
                                    `"${link}"`,
                                  ]);
                                });
                                const csvContent =
                                  "\uFEFF" +
                                  csvRows.map((e) => e.join(",")).join("\n");
                                const blob = new Blob([csvContent], {
                                  type: "text/csv;charset=utf-8;",
                                });
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement("a");
                                link.href = url;
                                link.setAttribute(
                                  "download",
                                  `Voter_Links_${activeData.config.electionTitle.replace(
                                    /[^a-z0-9]/gi,
                                    "_"
                                  )}.csv`
                                );
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              style={{
                                padding: "8px 16px",
                                backgroundColor: "#ecfdf5",
                                color: "#059669",
                                border: "1px solid #a7f3d0",
                                borderRadius: "6px",
                                fontSize: "14px",
                                fontWeight: 500,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                fontFamily: "inherit",
                              }}
                            >
                              <Download size={16} /> Export All Links (CSV)
                            </button>
                            <button
                              onClick={downloadVoterCardsPDF}
                              style={{
                                padding: "8px 16px",
                                backgroundColor: "#f8fafc",
                                color: "#334155",
                                border: "1px solid #cbd5e1",
                                borderRadius: "6px",
                                fontSize: "14px",
                                fontWeight: 500,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                fontFamily: "inherit",
                              }}
                            >
                              <Download size={16} /> Download Vote Cards (PDF)
                            </button>
                            <button
                              onClick={() => {
                                if (!activeData) return;
                                const allLinks = activeData.voters
                                  .map(
                                    (v) =>
                                      `${v.voterName}: ${window.location.origin}/?token=${v.token}&election=${activeData.config.id}`
                                  )
                                  .join("\n");
                                navigator.clipboard.writeText(allLinks);
                                alert(
                                  `Copied ${activeData.voters.length} links to clipboard!`
                                );
                              }}
                              style={{
                                padding: "8px 16px",
                                backgroundColor: "#f8fafc",
                                color: "#334155",
                                border: "1px solid #cbd5e1",
                                borderRadius: "6px",
                                fontSize: "14px",
                                fontWeight: 500,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                fontFamily: "inherit",
                              }}
                            >
                              <Copy size={16} /> Copy All Links
                            </button>
                            <button
                              onClick={printSignInSheet}
                              style={{
                                padding: "8px 16px",
                                backgroundColor: "#f8fafc",
                                color: "#334155",
                                border: "1px solid #cbd5e1",
                                borderRadius: "6px",
                                fontSize: "14px",
                                fontWeight: 500,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                fontFamily: "inherit",
                              }}
                            >
                              <Printer size={16} /> Print Sign-In Sheet
                            </button>
                            <input
                              type="text"
                              placeholder="Search name, email, key or receipt code..."
                              value={voterSearch}
                              onChange={(e) => {
                                setVoterSearch(e.target.value);
                                setVoterPage(1);
                              }}
                              style={{
                                flex: 1,
                                minWidth: "200px",
                                padding: "8px 12px",
                                border: "1px solid #cbd5e1",
                                borderRadius: "6px",
                                fontSize: "14px",
                                boxSizing: "border-box",
                                fontFamily: "inherit",
                              }}
                            />
                            <select
                              value={voterFilter}
                              onChange={(e) => {
                                setVoterFilter(e.target.value as any);
                                setVoterPage(1);
                              }}
                              style={{
                                padding: "8px 12px",
                                border: "1px solid #cbd5e1",
                                borderRadius: "6px",
                                fontSize: "14px",
                                fontFamily: "inherit",
                                backgroundColor: "white",
                                cursor: "pointer",
                              }}
                            >
                              <option value="all">
                                All ({activeData.voters.length})
                              </option>
                              <option value="voted">
                                Voted (
                                {
                                  activeData.voters.filter((v) => v.hasVoted)
                                    .length
                                }
                                )
                              </option>
                              <option value="pending">
                                Not Voted (
                                {
                                  activeData.voters.filter((v) => !v.hasVoted)
                                    .length
                                }
                                )
                              </option>
                            </select>
                          </div>

                          {selectedVoters.length > 0 && (
                            <div
                              style={{
                                backgroundColor: "#eff6ff",
                                padding: "12px 16px",
                                borderRadius: "8px",
                                border: "1px solid #bfdbfe",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "14px",
                                  color: "#1e3a8a",
                                  fontWeight: 500,
                                }}
                              >
                                {selectedVoters.length} voter(s) selected
                              </span>
                              <button
                                onClick={handleBatchDeleteVoters}
                                style={{
                                  padding: "6px 12px",
                                  backgroundColor: "#e11d48",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "6px",
                                  fontSize: "13px",
                                  fontWeight: "bold",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <Trash2 size={14} /> Delete Selected
                              </button>
                            </div>
                          )}

                          <div
                            style={{
                              display: "flex",
                              gap: "16px",
                              alignItems: "flex-end",
                              backgroundColor: "#f8fafc",
                              padding: "16px",
                              border: "1px solid #e2e8f0",
                              borderRadius: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ flex: 1, minWidth: "150px" }}>
                              <label
                                style={{
                                  display: "block",
                                  fontSize: "12px",
                                  fontWeight: 500,
                                  marginBottom: "4px",
                                }}
                              >
                                Name
                              </label>
                              <input
                                type="text"
                                value={voterName}
                                onChange={(e) => setVoterName(e.target.value)}
                                style={{
                                  width: "100%",
                                  padding: "8px 12px",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: "6px",
                                  fontSize: "14px",
                                  boxSizing: "border-box",
                                  fontFamily: "inherit",
                                }}
                              />
                            </div>
                            <div style={{ flex: 1, minWidth: "150px" }}>
                              <label
                                style={{
                                  display: "block",
                                  fontSize: "12px",
                                  fontWeight: 500,
                                  marginBottom: "4px",
                                }}
                              >
                                Email
                              </label>
                              <input
                                type="email"
                                value={voterEmail}
                                onChange={(e) => setVoterEmail(e.target.value)}
                                style={{
                                  width: "100%",
                                  padding: "8px 12px",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: "6px",
                                  fontSize: "14px",
                                  boxSizing: "border-box",
                                  fontFamily: "inherit",
                                }}
                              />
                            </div>
                            <button
                              onClick={async () => {
                                if (!voterName || isAddingVoter) return;
                                setIsAddingVoter(true);
                                const token =
                                  "HKGBC-" +
                                  Math.random()
                                    .toString(36)
                                    .substring(2, 6)
                                    .toUpperCase() +
                                  "-" +
                                  Math.floor(100 + Math.random() * 900);
                                await saveToFirestore({
                                  ...activeData,
                                  voters: [
                                    ...activeData.voters,
                                    {
                                      id: "v" + Date.now(),
                                      voterName,
                                      email: voterEmail,
                                      token,
                                      hasVoted: false,
                                    },
                                  ],
                                });
                                setIsAddingVoter(false);
                                setVoterName("");
                                setVoterEmail("");
                              }}
                              disabled={isAddingVoter}
                              style={{
                                padding: "8px 16px",
                                backgroundColor: isAddingVoter
                                  ? "#94a3b8"
                                  : "#0f172a",
                                color: "white",
                                fontSize: "14px",
                                fontWeight: 500,
                                borderRadius: "6px",
                                border: "none",
                                cursor: isAddingVoter
                                  ? "not-allowed"
                                  : "pointer",
                                height: "38px",
                                fontFamily: "inherit",
                              }}
                            >
                              {isAddingVoter ? "Adding..." : "Add Voter"}
                            </button>
                          </div>

                          <div
                            style={{
                              border: "1px solid #e2e8f0",
                              borderRadius: "8px",
                              overflowX: "auto",
                            }}
                          >
                            <table
                              style={{
                                width: "100%",
                                minWidth: "650px",
                                textAlign: "left",
                                fontSize: "14px",
                                borderCollapse: "collapse",
                              }}
                            >
                              <thead
                                style={{
                                  backgroundColor: "#f8fafc",
                                  borderBottom: "1px solid #e2e8f0",
                                }}
                              >
                                <tr>
                                  <th
                                    style={{ padding: "12px", width: "40px" }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={
                                        paginatedVoters.length > 0 &&
                                        paginatedVoters.every((v) =>
                                          selectedVoters.includes(v.id)
                                        )
                                      }
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          const newSelections = new Set([
                                            ...selectedVoters,
                                            ...paginatedVoters.map((v) => v.id),
                                          ]);
                                          setSelectedVoters(
                                            Array.from(newSelections)
                                          );
                                        } else {
                                          setSelectedVoters(
                                            selectedVoters.filter(
                                              (id) =>
                                                !paginatedVoters.some(
                                                  (v) => v.id === id
                                                )
                                            )
                                          );
                                        }
                                      }}
                                      style={{
                                        cursor: "pointer",
                                        width: "16px",
                                        height: "16px",
                                      }}
                                    />
                                  </th>
                                  <th
                                    style={{ padding: "12px", fontWeight: 500 }}
                                  >
                                    Name
                                  </th>
                                  <th
                                    style={{ padding: "12px", fontWeight: 500 }}
                                  >
                                    Key
                                  </th>
                                  <th
                                    style={{ padding: "12px", fontWeight: 500 }}
                                  >
                                    Receipt Code
                                  </th>
                                  <th
                                    style={{ padding: "12px", fontWeight: 500 }}
                                  >
                                    Status
                                  </th>
                                  <th
                                    style={{
                                      padding: "12px",
                                      fontWeight: 500,
                                      textAlign: "right",
                                    }}
                                  >
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {paginatedVoters.length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan={6}
                                      style={{
                                        padding: "24px",
                                        textAlign: "center",
                                        color: "#94a3b8",
                                        fontSize: "14px",
                                      }}
                                    >
                                      No voters match your search.
                                    </td>
                                  </tr>
                                ) : (
                                  paginatedVoters.map((v) => (
                                    <tr
                                      key={v.id}
                                      style={{
                                        borderBottom: "1px solid #f1f5f9",
                                        backgroundColor:
                                          selectedVoters.includes(v.id)
                                            ? "#f8fafc"
                                            : "transparent",
                                      }}
                                    >
                                      <td style={{ padding: "12px" }}>
                                        <input
                                          type="checkbox"
                                          checked={selectedVoters.includes(
                                            v.id
                                          )}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setSelectedVoters([
                                                ...selectedVoters,
                                                v.id,
                                              ]);
                                            } else {
                                              setSelectedVoters(
                                                selectedVoters.filter(
                                                  (id) => id !== v.id
                                                )
                                              );
                                            }
                                          }}
                                          style={{
                                            cursor: "pointer",
                                            width: "16px",
                                            height: "16px",
                                          }}
                                        />
                                      </td>
                                      <td style={{ padding: "12px" }}>
                                        <div style={{ fontWeight: 500 }}>
                                          {v.voterName}
                                        </div>
                                        <div
                                          style={{
                                            fontSize: "12px",
                                            color: "#64748b",
                                          }}
                                        >
                                          {v.email}
                                        </div>
                                      </td>
                                      <td
                                        style={{
                                          padding: "12px",
                                          fontFamily: "monospace",
                                          color: "#475569",
                                        }}
                                      >
                                        {v.token}
                                      </td>
                                      <td
                                        style={{
                                          padding: "12px",
                                          fontFamily: "monospace",
                                          color: "#0f172a",
                                          fontSize: "12px",
                                        }}
                                      >
                                        {v.receiptCode ? (
                                          activeData.config.isSecretBallot ? (
                                            <span
                                              style={{ color: "#475569" }}
                                              title="Hidden due to Secret Ballot"
                                            >
                                              {v.receiptCode}
                                            </span>
                                          ) : (
                                            <a
                                              href={`${window.location.origin}/?verify=${v.receiptCode}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              style={{
                                                color: "#2563eb",
                                                textDecoration: "none",
                                              }}
                                            >
                                              {v.receiptCode}
                                            </a>
                                          )
                                        ) : (
                                          <span style={{ color: "#cbd5e1" }}>
                                            —
                                          </span>
                                        )}
                                      </td>
                                      <td style={{ padding: "12px" }}>
                                        <div>
                                          <span
                                            style={{
                                              padding: "4px 8px",
                                              borderRadius: "4px",
                                              fontSize: "12px",
                                              fontWeight: 500,
                                              backgroundColor: v.hasVoted
                                                ? "#dcfce7"
                                                : "#f1f5f9",
                                              color: v.hasVoted
                                                ? "#15803d"
                                                : "#475569",
                                            }}
                                          >
                                            {v.hasVoted ? "Voted" : "Pending"}
                                          </span>
                                        </div>
                                        {v.hasVoted && v.votedAt && (
                                          <div
                                            style={{
                                              fontSize: "11px",
                                              color: "#94a3b8",
                                              marginTop: "4px",
                                            }}
                                          >
                                            {v.votedAt}
                                          </div>
                                        )}
                                      </td>
                                      <td
                                        style={{
                                          padding: "12px",
                                          textAlign: "right",
                                        }}
                                      >
                                        <div
                                          style={{
                                            display: "flex",
                                            gap: "8px",
                                            justifyContent: "flex-end",
                                          }}
                                        >
                                          <button
                                            onClick={() =>
                                              safeCopyText(
                                                `${window.location.origin}/?token=${v.token}&election=${activeData.config.id}`,
                                                v.id
                                              )
                                            }
                                            style={{
                                              background: "none",
                                              border: "none",
                                              cursor: "pointer",
                                              color: "#64748b",
                                            }}
                                            title="Copy Link"
                                          >
                                            <Copy size={16} />
                                          </button>
                                          {v.hasVoted && (
                                            <button
                                              onClick={() =>
                                                resetVoterStatus(v.id)
                                              }
                                              style={{
                                                background: "none",
                                                border: "none",
                                                cursor: "pointer",
                                                color: "#f59e0b",
                                              }}
                                              title="Reset Status & Void Vote"
                                            >
                                              <RefreshCw size={16} />
                                            </button>
                                          )}
                                          <button
                                            onClick={() => deleteVoter(v.id)}
                                            style={{
                                              background: "none",
                                              border: "none",
                                              cursor: "pointer",
                                              color: "#ef4444",
                                            }}
                                            title="Delete Voter"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>

                          {totalPages > 1 && (
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginTop: "16px",
                              }}
                            >
                              <span
                                style={{ fontSize: "14px", color: "#64748b" }}
                              >
                                Showing {(voterPage - 1) * votersPerPage + 1} to{" "}
                                {Math.min(
                                  voterPage * votersPerPage,
                                  filteredVoters.length
                                )}{" "}
                                of {filteredVoters.length} voters
                              </span>
                              <div style={{ display: "flex", gap: "8px" }}>
                                <button
                                  onClick={() =>
                                    setVoterPage((p) => Math.max(1, p - 1))
                                  }
                                  disabled={voterPage === 1}
                                  style={{
                                    padding: "6px 12px",
                                    borderRadius: "6px",
                                    border: "1px solid #cbd5e1",
                                    backgroundColor:
                                      voterPage === 1 ? "#f1f5f9" : "white",
                                    cursor:
                                      voterPage === 1
                                        ? "not-allowed"
                                        : "pointer",
                                    fontFamily: "inherit",
                                  }}
                                >
                                  Previous
                                </button>
                                <button
                                  onClick={() =>
                                    setVoterPage((p) =>
                                      Math.min(totalPages, p + 1)
                                    )
                                  }
                                  disabled={voterPage === totalPages}
                                  style={{
                                    padding: "6px 12px",
                                    borderRadius: "6px",
                                    border: "1px solid #cbd5e1",
                                    backgroundColor:
                                      voterPage === totalPages
                                        ? "#f1f5f9"
                                        : "white",
                                    cursor:
                                      voterPage === totalPages
                                        ? "not-allowed"
                                        : "pointer",
                                    fontFamily: "inherit",
                                  }}
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {adminTab === "candidates" && activeData && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "24px",
                            maxWidth: "800px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "flex-end",
                              marginBottom: "8px",
                            }}
                          >
                            <label
                              style={{
                                padding: "8px 16px",
                                backgroundColor: "#eff6ff",
                                color: "#1d4ed8",
                                border: "1px solid #bfdbfe",
                                borderRadius: "6px",
                                fontSize: "14px",
                                fontWeight: 500,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                fontFamily: "inherit",
                              }}
                            >
                              <Upload size={16} /> Import Candidates (CSV)
                              <input
                                type="file"
                                accept=".csv,text/csv"
                                style={{ display: "none" }}
                                onChange={handleCandidateCSVImport}
                              />
                            </label>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "16px",
                              backgroundColor: "#f8fafc",
                              padding: "16px",
                              border: "1px solid #e2e8f0",
                              borderRadius: "8px",
                            }}
                          >
                            <h3
                              style={{
                                margin: 0,
                                fontSize: "16px",
                                fontWeight: "bold",
                              }}
                            >
                              {editingCandidateId
                                ? "Edit Candidate"
                                : "Add New Candidate"}
                            </h3>
                            <div
                              style={{
                                display: "flex",
                                gap: "16px",
                                flexWrap: "wrap",
                              }}
                            >
                              <div style={{ flex: 1, minWidth: "150px" }}>
                                <label
                                  style={{
                                    display: "block",
                                    fontSize: "12px",
                                    fontWeight: 500,
                                    marginBottom: "4px",
                                  }}
                                >
                                  Name <span style={{ color: "red" }}>*</span>
                                </label>
                                <input
                                  type="text"
                                  placeholder="Required"
                                  value={candName}
                                  onChange={(e) => setCandName(e.target.value)}
                                  style={{
                                    width: "100%",
                                    padding: "8px 12px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "6px",
                                    fontSize: "14px",
                                    boxSizing: "border-box",
                                    fontFamily: "inherit",
                                  }}
                                />
                              </div>
                              <div style={{ flex: 1, minWidth: "150px" }}>
                                <label
                                  style={{
                                    display: "block",
                                    fontSize: "12px",
                                    fontWeight: 500,
                                    marginBottom: "4px",
                                  }}
                                >
                                  Title (Optional)
                                </label>
                                <input
                                  type="text"
                                  placeholder="Optional"
                                  value={candTitle}
                                  onChange={(e) => setCandTitle(e.target.value)}
                                  style={{
                                    width: "100%",
                                    padding: "8px 12px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "6px",
                                    fontSize: "14px",
                                    boxSizing: "border-box",
                                    fontFamily: "inherit",
                                  }}
                                />
                              </div>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "16px",
                                flexWrap: "wrap",
                              }}
                            >
                              <div style={{ flex: 1, minWidth: "150px" }}>
                                <label
                                  style={{
                                    display: "block",
                                    fontSize: "12px",
                                    fontWeight: 500,
                                    marginBottom: "4px",
                                  }}
                                >
                                  Position{" "}
                                  <span style={{ color: "red" }}>*</span>
                                </label>
                                <select
                                  value={candPositionId}
                                  onChange={(e) =>
                                    setCandPositionId(e.target.value)
                                  }
                                  style={{
                                    width: "100%",
                                    padding: "8px 12px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "6px",
                                    fontSize: "14px",
                                    boxSizing: "border-box",
                                    fontFamily: "inherit",
                                    backgroundColor: "white",
                                  }}
                                >
                                  <option value="" disabled>
                                    Select a position...
                                  </option>
                                  {activeData.positions?.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.title}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div style={{ flex: 1, minWidth: "150px" }}>
                                <label
                                  style={{
                                    display: "block",
                                    fontSize: "12px",
                                    fontWeight: 500,
                                    marginBottom: "4px",
                                  }}
                                >
                                  Info Link (URL) (Optional)
                                </label>
                                <input
                                  type="url"
                                  placeholder="https://... (Optional)"
                                  value={candInfoUrl}
                                  onChange={(e) =>
                                    setCandInfoUrl(e.target.value)
                                  }
                                  style={{
                                    width: "100%",
                                    padding: "8px 12px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "6px",
                                    fontSize: "14px",
                                    boxSizing: "border-box",
                                    fontFamily: "inherit",
                                  }}
                                />
                              </div>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "16px",
                                flexWrap: "wrap",
                              }}
                            >
                              <div style={{ flex: 1, minWidth: "150px" }}>
                                <label
                                  style={{
                                    display: "block",
                                    fontSize: "12px",
                                    fontWeight: 500,
                                    marginBottom: "4px",
                                  }}
                                >
                                  Photo (Optional)
                                </label>
                                <div style={{ display: "flex", gap: "8px" }}>
                                  <button
                                    onClick={() =>
                                      fileInputRef.current?.click()
                                    }
                                    style={{
                                      padding: "8px 16px",
                                      backgroundColor: "white",
                                      border: "1px solid #cbd5e1",
                                      borderRadius: "6px",
                                      fontSize: "14px",
                                      fontWeight: 500,
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                      fontFamily: "inherit",
                                    }}
                                  >
                                    <Upload size={16} /> Upload Image
                                  </button>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    ref={fileInputRef}
                                    onChange={handleImageUpload}
                                    style={{ display: "none" }}
                                  />
                                  {candImage && (
                                    <img
                                      src={candImage}
                                      style={{
                                        width: "38px",
                                        height: "38px",
                                        borderRadius: "50%",
                                        objectFit: "cover",
                                      }}
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                marginTop: "8px",
                              }}
                            >
                              <button
                                onClick={saveCandidate}
                                disabled={isSavingCandidate}
                                style={{
                                  padding: "10px 24px",
                                  backgroundColor: isSavingCandidate
                                    ? "#94a3b8"
                                    : "#0f172a",
                                  color: "white",
                                  fontSize: "14px",
                                  fontWeight: 500,
                                  borderRadius: "6px",
                                  border: "none",
                                  cursor: isSavingCandidate
                                    ? "not-allowed"
                                    : "pointer",
                                  fontFamily: "inherit",
                                }}
                              >
                                {isSavingCandidate
                                  ? "Saving..."
                                  : editingCandidateId
                                  ? "Save Changes"
                                  : "Add Candidate"}
                              </button>
                              {editingCandidateId && (
                                <button
                                  onClick={() => {
                                    setEditingCandidateId(null);
                                    setCandName("");
                                    setCandTitle("");
                                    setCandPositionId("");
                                    setCandImage(undefined);
                                    setCandInfoUrl("");
                                  }}
                                  style={{
                                    padding: "10px 24px",
                                    backgroundColor: "white",
                                    color: "#64748b",
                                    border: "1px solid #cbd5e1",
                                    fontSize: "14px",
                                    fontWeight: 500,
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                  }}
                                >
                                  Cancel Edit
                                </button>
                              )}
                            </div>
                          </div>

                          {activeData.positions?.map((pos) => {
                            const posCandidates = activeData.candidates.filter(
                              (c) => c.positionId === pos.id
                            );
                            if (posCandidates.length === 0) return null;
                            return (
                              <div
                                key={pos.id}
                                style={{ marginBottom: "16px" }}
                              >
                                <h4
                                  style={{
                                    margin: "0 0 12px 0",
                                    fontSize: "15px",
                                    color: "#475569",
                                    borderBottom: "1px solid #cbd5e1",
                                    paddingBottom: "8px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                  }}
                                >
                                  {pos.title}
                                  <span
                                    style={{
                                      fontSize: "12px",
                                      backgroundColor: "#f1f5f9",
                                      padding: "2px 8px",
                                      borderRadius: "4px",
                                      color: "#64748b",
                                      fontWeight: "normal",
                                    }}
                                  >
                                    {posCandidates.length} candidates
                                  </span>
                                </h4>
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                      "repeat(auto-fill, minmax(280px, 1fr))",
                                    gap: "16px",
                                  }}
                                >
                                  {posCandidates.map((c) => {
                                    const globalIndex =
                                      activeData.candidates.findIndex(
                                        (x) => x.id === c.id
                                      );
                                    const isFirst = globalIndex === 0;
                                    const isLast =
                                      globalIndex ===
                                      activeData.candidates.length - 1;
                                    const moveUp = (e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      if (isFirst) return;
                                      const newCandidates = [
                                        ...activeData.candidates,
                                      ];
                                      [
                                        newCandidates[globalIndex - 1],
                                        newCandidates[globalIndex],
                                      ] = [
                                        newCandidates[globalIndex],
                                        newCandidates[globalIndex - 1],
                                      ];
                                      saveToFirestore({
                                        ...activeData,
                                        candidates: newCandidates,
                                      });
                                    };
                                    const moveDown = (e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      if (isLast) return;
                                      const newCandidates = [
                                        ...activeData.candidates,
                                      ];
                                      [
                                        newCandidates[globalIndex + 1],
                                        newCandidates[globalIndex],
                                      ] = [
                                        newCandidates[globalIndex],
                                        newCandidates[globalIndex + 1],
                                      ];
                                      saveToFirestore({
                                        ...activeData,
                                        candidates: newCandidates,
                                      });
                                    };
                                    return (
                                      <div
                                        key={c.id}
                                        style={{
                                          border: "1px solid #e2e8f0",
                                          padding: "16px",
                                          borderRadius: "8px",
                                          display: "flex",
                                          justifyContent: "space-between",
                                          alignItems: "center",
                                          backgroundColor: "white",
                                          gap: "8px",
                                        }}
                                      >
                                        <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "12px",
                                            minWidth: 0,
                                            flex: 1,
                                          }}
                                        >
                                          {c.imageUrl ? (
                                            <img
                                              src={c.imageUrl}
                                              style={{
                                                width: "40px",
                                                height: "40px",
                                                borderRadius: "50%",
                                                objectFit: "cover",
                                                flexShrink: 0,
                                              }}
                                            />
                                          ) : (
                                            <div
                                              style={{
                                                width: "40px",
                                                height: "40px",
                                                borderRadius: "50%",
                                                backgroundColor: "#f1f5f9",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontWeight: "bold",
                                                color: "#94a3b8",
                                                flexShrink: 0,
                                              }}
                                            >
                                              {c.name.charAt(0)}
                                            </div>
                                          )}
                                          <div style={{ minWidth: 0 }}>
                                            <div
                                              style={{
                                                fontWeight: 500,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                              }}
                                            >
                                              {c.name}
                                            </div>
                                            <div
                                              style={{
                                                fontSize: "14px",
                                                color: "#64748b",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                              }}
                                            >
                                              {c.title}
                                            </div>
                                            {c.infoUrl && (
                                              <div
                                                style={{
                                                  fontSize: "11px",
                                                  color: "#2563eb",
                                                  marginTop: "2px",
                                                }}
                                              >
                                                Has Link
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <div
                                          style={{
                                            display: "flex",
                                            gap: "4px",
                                            flexShrink: 0,
                                            alignItems: "center",
                                          }}
                                        >
                                          <div
                                            style={{
                                              display: "flex",
                                              flexDirection: "column",
                                              gap: "2px",
                                              marginRight: "8px",
                                            }}
                                          >
                                            <button
                                              onClick={moveUp}
                                              disabled={isFirst}
                                              style={{
                                                background: "none",
                                                border: "none",
                                                cursor: isFirst
                                                  ? "not-allowed"
                                                  : "pointer",
                                                color: isFirst
                                                  ? "#e2e8f0"
                                                  : "#94a3b8",
                                                padding: 0,
                                              }}
                                              title="Move Up"
                                            >
                                              <ArrowUp size={16} />
                                            </button>
                                            <button
                                              onClick={moveDown}
                                              disabled={isLast}
                                              style={{
                                                background: "none",
                                                border: "none",
                                                cursor: isLast
                                                  ? "not-allowed"
                                                  : "pointer",
                                                color: isLast
                                                  ? "#e2e8f0"
                                                  : "#94a3b8",
                                                padding: 0,
                                              }}
                                              title="Move Down"
                                            >
                                              <ArrowDown size={16} />
                                            </button>
                                          </div>
                                          <button
                                            onClick={() =>
                                              startEditCandidate(c)
                                            }
                                            style={{
                                              background: "none",
                                              border: "none",
                                              cursor: "pointer",
                                              color: "#64748b",
                                              padding: "4px",
                                            }}
                                            title="Edit Candidate"
                                          >
                                            <Pencil size={16} />
                                          </button>
                                          <button
                                            onClick={() =>
                                              saveToFirestore({
                                                ...activeData,
                                                candidates:
                                                  activeData.candidates.filter(
                                                    (x) => x.id !== c.id
                                                  ),
                                              })
                                            }
                                            style={{
                                              background: "none",
                                              border: "none",
                                              cursor: "pointer",
                                              color: "#f87171",
                                              padding: "4px",
                                            }}
                                            title="Delete Candidate"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {adminTab === "settings" && editConfig && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "20px",
                            maxWidth: "600px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              backgroundColor: "#f8fafc",
                              padding: "16px",
                              border: "1px solid #e2e8f0",
                              borderRadius: "8px",
                              flexWrap: "wrap",
                              gap: "8px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                onClick={startPreview}
                                style={{
                                  padding: "8px 16px",
                                  backgroundColor: "#eff6ff",
                                  color: "#1d4ed8",
                                  border: "1px solid #bfdbfe",
                                  borderRadius: "6px",
                                  fontSize: "14px",
                                  fontWeight: "bold",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  fontFamily: "inherit",
                                }}
                              >
                                <Eye size={16} /> Preview
                              </button>
                              {!editConfig.isLaunched &&
                                !editConfig.isHardEnded && (
                                  <button
                                    onClick={launchElection}
                                    disabled={isLaunching}
                                    style={{
                                      padding: "8px 16px",
                                      backgroundColor: isLaunching
                                        ? "#94a3b8"
                                        : "#059669",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "6px",
                                      fontSize: "14px",
                                      fontWeight: "bold",
                                      cursor: isLaunching
                                        ? "not-allowed"
                                        : "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "6px",
                                      fontFamily: "inherit",
                                    }}
                                  >
                                    <Rocket size={16} />{" "}
                                    {isLaunching ? "Launching..." : "Launch"}
                                  </button>
                                )}
                              {editConfig.isLaunched &&
                                !editConfig.isPaused &&
                                !editConfig.isHardEnded && (
                                  <>
                                    <button
                                      onClick={pauseElection}
                                      style={{
                                        padding: "8px 16px",
                                        backgroundColor: "#f59e0b",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "6px",
                                        fontSize: "14px",
                                        fontWeight: "bold",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        fontFamily: "inherit",
                                      }}
                                    >
                                      <Pause size={16} /> Pause
                                    </button>
                                    <button
                                      onClick={forceEndElection}
                                      style={{
                                        padding: "8px 16px",
                                        backgroundColor: "#e11d48",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "6px",
                                        fontSize: "14px",
                                        fontWeight: "bold",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        fontFamily: "inherit",
                                      }}
                                    >
                                      <Square size={16} /> Force End
                                    </button>
                                  </>
                                )}
                              {editConfig.isPaused &&
                                !editConfig.isHardEnded && (
                                  <>
                                    <button
                                      onClick={resumeElection}
                                      style={{
                                        padding: "8px 16px",
                                        backgroundColor: "#059669",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "6px",
                                        fontSize: "14px",
                                        fontWeight: "bold",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        fontFamily: "inherit",
                                      }}
                                    >
                                      <Play size={16} /> Resume
                                    </button>
                                    <button
                                      onClick={forceEndElection}
                                      style={{
                                        padding: "8px 16px",
                                        backgroundColor: "#e11d48",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "6px",
                                        fontSize: "14px",
                                        fontWeight: "bold",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        fontFamily: "inherit",
                                      }}
                                    >
                                      <Square size={16} /> Force End
                                    </button>
                                  </>
                                )}
                            </div>
                          </div>

                          <div
                            style={{
                              backgroundColor: "#f1f5f9",
                              padding: "12px",
                              borderRadius: "8px",
                              border: "1px solid #cbd5e1",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              fontSize: "14px",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <span style={{ fontWeight: 500 }}>
                              Current Local Time (Live):
                            </span>
                            <span
                              style={{ fontWeight: "bold", color: "#0f172a" }}
                            >
                              {displayTimeNow}
                            </span>
                          </div>

                          <div
                            style={{
                              backgroundColor: "white",
                              padding: "16px",
                              borderRadius: "8px",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            <h3
                              style={{
                                fontSize: "16px",
                                fontWeight: "bold",
                                marginBottom: "16px",
                                color: "#0f172a",
                                borderBottom: "1px solid #e2e8f0",
                                paddingBottom: "8px",
                              }}
                            >
                              General Info
                            </h3>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "16px",
                              }}
                            >
                              <div>
                                <label
                                  style={{
                                    display: "block",
                                    fontSize: "14px",
                                    fontWeight: 500,
                                    marginBottom: "6px",
                                  }}
                                >
                                  Organization Name
                                </label>
                                <input
                                  type="text"
                                  value={editConfig.orgName}
                                  onChange={(e) =>
                                    setEditConfig({
                                      ...editConfig,
                                      orgName: e.target.value,
                                    })
                                  }
                                  style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "6px",
                                    fontSize: "14px",
                                    boxSizing: "border-box",
                                    fontFamily: "inherit",
                                  }}
                                />
                              </div>
                              <div>
                                <label
                                  style={{
                                    display: "block",
                                    fontSize: "14px",
                                    fontWeight: 500,
                                    marginBottom: "6px",
                                  }}
                                >
                                  Election Title
                                </label>
                                <textarea
                                  value={editConfig.electionTitle}
                                  onChange={(e) =>
                                    setEditConfig({
                                      ...editConfig,
                                      electionTitle: e.target.value,
                                    })
                                  }
                                  rows={2}
                                  style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "6px",
                                    fontSize: "14px",
                                    boxSizing: "border-box",
                                    resize: "vertical",
                                    fontFamily: "inherit",
                                  }}
                                />
                              </div>
                              <div>
                                <label
                                  style={{
                                    display: "block",
                                    fontSize: "14px",
                                    fontWeight: 500,
                                    marginBottom: "6px",
                                  }}
                                >
                                  Subsector / Category Name
                                </label>
                                <input
                                  type="text"
                                  value={editConfig.subsectorName}
                                  onChange={(e) =>
                                    setEditConfig({
                                      ...editConfig,
                                      subsectorName: e.target.value,
                                    })
                                  }
                                  style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "6px",
                                    fontSize: "14px",
                                    boxSizing: "border-box",
                                    fontFamily: "inherit",
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              backgroundColor: "white",
                              padding: "16px",
                              borderRadius: "8px",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            <h3
                              style={{
                                fontSize: "16px",
                                fontWeight: "bold",
                                marginBottom: "16px",
                                color: "#0f172a",
                                borderBottom: "1px solid #e2e8f0",
                                paddingBottom: "8px",
                              }}
                            >
                              Timing
                            </h3>
                            <div
                              style={{
                                display: "flex",
                                gap: "16px",
                                flexWrap: "wrap",
                              }}
                            >
                              <div style={{ flex: 1, minWidth: "150px" }}>
                                <label
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    fontSize: "14px",
                                    fontWeight: 500,
                                    marginBottom: "6px",
                                  }}
                                >
                                  <Clock size={16} /> Start Time
                                </label>
                                <input
                                  type="datetime-local"
                                  value={editConfig.startTime}
                                  onChange={(e) =>
                                    setEditConfig({
                                      ...editConfig,
                                      startTime: e.target.value,
                                    })
                                  }
                                  style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "6px",
                                    fontSize: "14px",
                                    boxSizing: "border-box",
                                    fontFamily: "inherit",
                                  }}
                                />
                              </div>
                              <div style={{ flex: 1, minWidth: "150px" }}>
                                <label
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    fontSize: "14px",
                                    fontWeight: 500,
                                    marginBottom: "6px",
                                  }}
                                >
                                  <Clock size={16} /> End Time
                                </label>
                                <input
                                  type="datetime-local"
                                  value={editConfig.endTime}
                                  onChange={(e) =>
                                    setEditConfig({
                                      ...editConfig,
                                      endTime: e.target.value,
                                    })
                                  }
                                  style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "6px",
                                    fontSize: "14px",
                                    boxSizing: "border-box",
                                    fontFamily: "inherit",
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              backgroundColor: "white",
                              padding: "16px",
                              borderRadius: "8px",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            <h3
                              style={{
                                fontSize: "16px",
                                fontWeight: "bold",
                                marginBottom: "16px",
                                color: "#0f172a",
                                borderBottom: "1px solid #e2e8f0",
                                paddingBottom: "8px",
                              }}
                            >
                              Text & Instructions
                            </h3>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "16px",
                              }}
                            >
                              <div>
                                <label
                                  style={{
                                    display: "block",
                                    fontSize: "14px",
                                    fontWeight: 500,
                                    marginBottom: "6px",
                                  }}
                                >
                                  Welcome Page Subtitle (Login screen)
                                </label>
                                <input
                                  type="text"
                                  value={editConfig.loginSubtitle}
                                  onChange={(e) =>
                                    setEditConfig({
                                      ...editConfig,
                                      loginSubtitle: e.target.value,
                                    })
                                  }
                                  style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "6px",
                                    fontSize: "14px",
                                    boxSizing: "border-box",
                                    fontFamily: "inherit",
                                  }}
                                />
                              </div>
                              <div>
                                <label
                                  style={{
                                    display: "block",
                                    fontSize: "14px",
                                    fontWeight: 500,
                                    marginBottom: "6px",
                                  }}
                                >
                                  Instructions Text (Ballot screen)
                                </label>
                                <input
                                  type="text"
                                  value={editConfig.instructionsText}
                                  onChange={(e) =>
                                    setEditConfig({
                                      ...editConfig,
                                      instructionsText: e.target.value,
                                    })
                                  }
                                  style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "6px",
                                    fontSize: "14px",
                                    boxSizing: "border-box",
                                    fontFamily: "inherit",
                                  }}
                                />
                              </div>
                              <div>
                                <label
                                  style={{
                                    display: "block",
                                    fontSize: "14px",
                                    fontWeight: 500,
                                    marginBottom: "6px",
                                  }}
                                >
                                  Acknowledgment Wording
                                </label>
                                <textarea
                                  value={editConfig.acknowledgmentText}
                                  onChange={(e) =>
                                    setEditConfig({
                                      ...editConfig,
                                      acknowledgmentText: e.target.value,
                                    })
                                  }
                                  rows={4}
                                  style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "6px",
                                    fontSize: "14px",
                                    boxSizing: "border-box",
                                    resize: "vertical",
                                    fontFamily: "inherit",
                                  }}
                                />
                              </div>
                              <div>
                                <label
                                  style={{
                                    display: "block",
                                    fontSize: "14px",
                                    fontWeight: 500,
                                    marginBottom: "6px",
                                  }}
                                >
                                  Thank You Message (Receipt screen)
                                </label>
                                <textarea
                                  value={editConfig.thankYouMessage}
                                  onChange={(e) =>
                                    setEditConfig({
                                      ...editConfig,
                                      thankYouMessage: e.target.value,
                                    })
                                  }
                                  rows={3}
                                  style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "6px",
                                    fontSize: "14px",
                                    boxSizing: "border-box",
                                    resize: "vertical",
                                    fontFamily: "inherit",
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              backgroundColor: "white",
                              padding: "16px",
                              borderRadius: "8px",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            <h3
                              style={{
                                fontSize: "16px",
                                fontWeight: "bold",
                                marginBottom: "16px",
                                color: "#0f172a",
                                borderBottom: "1px solid #e2e8f0",
                                paddingBottom: "8px",
                              }}
                            >
                              <Briefcase
                                size={16}
                                style={{
                                  display: "inline",
                                  verticalAlign: "text-bottom",
                                  marginRight: "6px",
                                }}
                              />{" "}
                              Positions & Roles
                            </h3>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "12px",
                                marginBottom: "16px",
                              }}
                            >
                              {editPositions.map((pos, index) => (
                                <div
                                  key={pos.id}
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "8px",
                                    backgroundColor: "#f8fafc",
                                    padding: "12px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "8px",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: "12px",
                                      alignItems: "flex-start",
                                    }}
                                  >
                                    <div style={{ flex: 2 }}>
                                      <label
                                        style={{
                                          display: "block",
                                          fontSize: "11px",
                                          color: "#64748b",
                                          marginBottom: "4px",
                                        }}
                                      >
                                        Title
                                      </label>
                                      <input
                                        type="text"
                                        value={pos.title}
                                        onChange={(e) => {
                                          const newPos = [...editPositions];
                                          newPos[index].title = e.target.value;
                                          setEditPositions(newPos);
                                        }}
                                        style={{
                                          width: "100%",
                                          padding: "6px 10px",
                                          border: "1px solid #cbd5e1",
                                          borderRadius: "4px",
                                          fontSize: "14px",
                                        }}
                                      />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <label
                                        style={{
                                          display: "block",
                                          fontSize: "11px",
                                          color: "#64748b",
                                          marginBottom: "4px",
                                        }}
                                      >
                                        Max Selects
                                      </label>
                                      <input
                                        type="number"
                                        min="1"
                                        value={pos.maxSelections}
                                        onChange={(e) => {
                                          const newPos = [...editPositions];
                                          newPos[index].maxSelections =
                                            parseInt(e.target.value) || 1;
                                          setEditPositions(newPos);
                                        }}
                                        style={{
                                          width: "100%",
                                          padding: "6px 10px",
                                          border: "1px solid #cbd5e1",
                                          borderRadius: "4px",
                                          fontSize: "14px",
                                        }}
                                      />
                                    </div>
                                    <button
                                      onClick={() => {
                                        const hasCandidates =
                                          activeData.candidates.some(
                                            (c) => c.positionId === pos.id
                                          );
                                        if (hasCandidates) {
                                          alert(
                                            "Cannot delete position: You must first delete or reassign the candidates assigned to it."
                                          );
                                          return;
                                        }
                                        setEditPositions(
                                          editPositions.filter(
                                            (p) => p.id !== pos.id
                                          )
                                        );
                                      }}
                                      style={{
                                        padding: "8px",
                                        backgroundColor: "#fff1f2",
                                        color: "#ef4444",
                                        border: "1px solid #fecdd3",
                                        borderRadius: "4px",
                                        cursor: "pointer",
                                        marginTop: "16px",
                                      }}
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                  <div>
                                    <label
                                      style={{
                                        display: "block",
                                        fontSize: "11px",
                                        color: "#64748b",
                                        marginBottom: "4px",
                                      }}
                                    >
                                      Description for Voters (Optional)
                                    </label>
                                    <input
                                      type="text"
                                      value={pos.description || ""}
                                      placeholder="e.g. Please select 1 candidate for Chairman."
                                      onChange={(e) => {
                                        const newPos = [...editPositions];
                                        newPos[index].description =
                                          e.target.value;
                                        setEditPositions(newPos);
                                      }}
                                      style={{
                                        width: "100%",
                                        padding: "6px 10px",
                                        border: "1px solid #cbd5e1",
                                        borderRadius: "4px",
                                        fontSize: "13px",
                                      }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                            <button
                              onClick={() => {
                                setEditPositions([
                                  ...editPositions,
                                  {
                                    id: "pos_" + Date.now(),
                                    title: "New Position",
                                    maxSelections: 1,
                                  },
                                ]);
                              }}
                              style={{
                                padding: "8px 16px",
                                backgroundColor: "#eff6ff",
                                color: "#1d4ed8",
                                border: "1px solid #bfdbfe",
                                borderRadius: "6px",
                                fontSize: "14px",
                                fontWeight: 500,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <Plus size={16} /> Add Position
                            </button>
                          </div>

                          <div
                            style={{
                              backgroundColor: "white",
                              padding: "16px",
                              borderRadius: "8px",
                              border: "1px solid #e2e8f0",
                              display: "flex",
                              flexDirection: "column",
                              gap: "16px",
                            }}
                          >
                            <h3
                              style={{
                                fontSize: "16px",
                                fontWeight: "bold",
                                marginBottom: "0",
                                color: "#0f172a",
                                borderBottom: "1px solid #e2e8f0",
                                paddingBottom: "8px",
                              }}
                            >
                              Security & Rules
                            </h3>
                            <div
                              style={{
                                padding: "16px",
                                border: "1px solid #e2e8f0",
                                borderRadius: "8px",
                                backgroundColor: editConfig.isSecretBallot
                                  ? "#f8fafc"
                                  : "#fff1f2",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: "12px",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  id="secretBallotToggle"
                                  checked={editConfig.isSecretBallot}
                                  onChange={(e) =>
                                    setEditConfig({
                                      ...editConfig,
                                      isSecretBallot: e.target.checked,
                                    })
                                  }
                                  style={{
                                    marginTop: "4px",
                                    width: "18px",
                                    height: "18px",
                                    cursor: "pointer",
                                  }}
                                />
                                <div>
                                  <label
                                    htmlFor="secretBallotToggle"
                                    style={{
                                      display: "block",
                                      fontSize: "14px",
                                      fontWeight: "bold",
                                      cursor: "pointer",
                                      color: editConfig.isSecretBallot
                                        ? "#0f172a"
                                        : "#e11d48",
                                      fontFamily: "inherit",
                                    }}
                                  >
                                    Enable Secret Ballot
                                  </label>
                                  <p
                                    style={{
                                      fontSize: "13px",
                                      color: "#64748b",
                                      margin: "4px 0 0 0",
                                      lineHeight: 1.4,
                                      fontFamily: "inherit",
                                    }}
                                  >
                                    {editConfig.isSecretBallot
                                      ? "Ballots are fully anonymous. The system will not link votes to voters in the database."
                                      : "Warning: Ballots are public. The Admin Dashboard will show a mapping of exactly which voter chose which candidates."}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div
                              style={{
                                padding: "16px",
                                border: "1px solid #e2e8f0",
                                borderRadius: "8px",
                                backgroundColor: editConfig.sealResults
                                  ? "#fef3c7"
                                  : "#f8fafc",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: "12px",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  id="sealResultsToggle"
                                  checked={editConfig.sealResults}
                                  onChange={(e) =>
                                    setEditConfig({
                                      ...editConfig,
                                      sealResults: e.target.checked,
                                    })
                                  }
                                  style={{
                                    marginTop: "4px",
                                    width: "18px",
                                    height: "18px",
                                    cursor: "pointer",
                                  }}
                                />
                                <div>
                                  <label
                                    htmlFor="sealResultsToggle"
                                    style={{
                                      display: "block",
                                      fontSize: "14px",
                                      fontWeight: "bold",
                                      cursor: "pointer",
                                      color: editConfig.sealResults
                                        ? "#92400e"
                                        : "#0f172a",
                                      fontFamily: "inherit",
                                    }}
                                  >
                                    Seal Results until End
                                  </label>
                                  <p
                                    style={{
                                      fontSize: "13px",
                                      color: "#64748b",
                                      margin: "4px 0 0 0",
                                      lineHeight: 1.4,
                                      fontFamily: "inherit",
                                    }}
                                  >
                                    {editConfig.sealResults
                                      ? "Results are hidden from EVERYONE (including Admin) until the election ends."
                                      : "Results are visible in real-time to the Admin only."}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              backgroundColor: "white",
                              padding: "16px",
                              borderRadius: "8px",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            <h3
                              style={{
                                fontSize: "16px",
                                fontWeight: "bold",
                                marginBottom: "16px",
                                color: "#0f172a",
                                borderBottom: "1px solid #e2e8f0",
                                paddingBottom: "8px",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <ShieldCheck size={18} /> Scrutineer Access
                            </h3>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "16px",
                              }}
                            >
                              <div>
                                <label
                                  style={{
                                    display: "block",
                                    fontSize: "14px",
                                    fontWeight: 500,
                                    marginBottom: "6px",
                                  }}
                                >
                                  Scrutineer Password
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. HKGBC-OBSERVER"
                                  value={editConfig.scrutineerPassword || ""}
                                  onChange={(e) =>
                                    setEditConfig({
                                      ...editConfig,
                                      scrutineerPassword: e.target.value,
                                    })
                                  }
                                  style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "6px",
                                    fontSize: "14px",
                                    boxSizing: "border-box",
                                    fontFamily: "inherit",
                                  }}
                                />
                                <p
                                  style={{
                                    fontSize: "12px",
                                    color: "#64748b",
                                    marginTop: "4px",
                                  }}
                                >
                                  The scrutineer will need this password to log
                                  in.
                                </p>
                              </div>
                              <div>
                                <label
                                  style={{
                                    display: "block",
                                    fontSize: "14px",
                                    fontWeight: 500,
                                    marginBottom: "6px",
                                  }}
                                >
                                  Scrutineer Link
                                </label>
                                <div style={{ display: "flex", gap: "8px" }}>
                                  <input
                                    type="text"
                                    readOnly
                                    value={`${window.location.origin}/?scrutineer=true&election=${editConfig.id}`}
                                    style={{
                                      flex: 1,
                                      padding: "10px 12px",
                                      backgroundColor: "#f8fafc",
                                      border: "1px solid #cbd5e1",
                                      borderRadius: "6px",
                                      fontSize: "14px",
                                      fontFamily: "monospace",
                                      color: "#475569",
                                    }}
                                  />
                                  <button
                                    onClick={() =>
                                      safeCopyText(
                                        `${window.location.origin}/?scrutineer=true&election=${editConfig.id}`,
                                        "scrut_link"
                                      )
                                    }
                                    style={{
                                      padding: "0 16px",
                                      backgroundColor: "#0F172A",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "6px",
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "6px",
                                      fontWeight: 500,
                                      fontFamily: "inherit",
                                    }}
                                  >
                                    <Copy size={16} />{" "}
                                    {copiedId === "scrut_link"
                                      ? "Copied!"
                                      : "Copy"}
                                  </button>
                                </div>
                                <p
                                  style={{
                                    fontSize: "12px",
                                    color: "#64748b",
                                    marginTop: "4px",
                                  }}
                                >
                                  Send this link and password to the scrutineer.
                                  They will only see read-only results.
                                </p>
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              marginTop: "16px",
                              paddingTop: "16px",
                              borderTop: "1px solid #e2e8f0",
                            }}
                          >
                            <button
                              onClick={saveSettings}
                              disabled={isSavingSettings}
                              style={{
                                padding: "10px 24px",
                                backgroundColor: isSavingSettings
                                  ? "#94a3b8"
                                  : "#059669",
                                color: "white",
                                border: "none",
                                borderRadius: "8px",
                                fontWeight: "bold",
                                fontSize: "14px",
                                cursor: isSavingSettings
                                  ? "not-allowed"
                                  : "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                fontFamily: "inherit",
                              }}
                            >
                              <Save size={18} />{" "}
                              {isSavingSettings ? "Saving..." : "Save Changes"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <footer
        style={{
          padding: "24px",
          borderTop: "1px solid #e2e8f0",
          backgroundColor: "white",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div style={{ fontSize: "14px", color: "#94a3b8" }}>
            © {new Date().getFullYear()}{" "}
            {activeData?.config.orgName ||
              "Hong Kong Green Building Council (Incorporated in Hong Kong with limited liability by guarantee)"}
            . All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
