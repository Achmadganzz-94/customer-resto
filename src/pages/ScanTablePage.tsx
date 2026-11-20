import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import {
  FiArrowLeft,
  FiCamera,
  FiCheck,
  FiHelpCircle,
  FiImage,
  FiLock,
  FiRefreshCw,
  FiZap,
} from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

import { api } from "../api/axios";
import { validateTable } from "../api/tableApi";
import type { Table } from "../types/table";

interface CustomerSession {
  sessionId: string;
  sessionToken: string;
  status: "ACTIVE" | "EXPIRED" | "COMPLETED";
  expiresAt: string | null;
  table: {
    id: string;
    tableNumber: number;
  };
}

interface CustomerSessionResponse {
  success: boolean;
  message: string;
  data: CustomerSession;
}

const READER_ID = "customer-qr-reader";   
const FILE_READER_ID = "customer-qr-file-reader";

const SESSION_TOKEN_KEY = "customerSessionToken";
const SESSION_ID_KEY = "customerSessionId";
const TABLE_ID_KEY = "customerTableId";
const TABLE_NUMBER_KEY = "customerTableNumber";

const CORNERS = [
  "left-0 top-0 rounded-tl-[24px] border-l-[3px] border-t-[3px]",
  "right-0 top-0 rounded-tr-[24px] border-r-[3px] border-t-[3px]",
  "bottom-0 left-0 rounded-bl-[24px] border-b-[3px] border-l-[3px]",
  "bottom-0 right-0 rounded-br-[24px] border-b-[3px] border-r-[3px]",
];

const clearStoredSession = () => {
  localStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem(SESSION_ID_KEY);
  localStorage.removeItem(TABLE_ID_KEY);
  localStorage.removeItem(TABLE_NUMBER_KEY);

  // Memberi tahu CartContext bahwa sesi customer sudah berakhir.
  window.dispatchEvent(new Event("customer-session-ended"));
};

const saveSession = (session: CustomerSession) => {
  localStorage.setItem(SESSION_TOKEN_KEY, session.sessionToken);
  localStorage.setItem(SESSION_ID_KEY, session.sessionId);
  localStorage.setItem(TABLE_ID_KEY, session.table.id);
  localStorage.setItem(TABLE_NUMBER_KEY, String(session.table.tableNumber));
};

const getApiErrorMessage = (err: unknown, fallback: string): string => {
  const error = err as {
    response?: {
      data?: {
        message?: string;
      };
    };
    message?: string;
  };

  return error?.response?.data?.message || error?.message || fallback;
};

const extractTableToken = (decodedText: string): string => {
  const text = decodedText.trim();

  if (!text) return "";

  try {
    const url = new URL(text);

    const queryToken = url.searchParams.get("table")?.trim();

    if (queryToken) return queryToken;

    const match = url.pathname.match(/^\/table\/([^/]+)\/?$/i);

    if (match?.[1]) {
      return decodeURIComponent(match[1]).trim();
    }

    return "";
  } catch {
    // QR juga boleh berisi token langsung, bukan URL.
    if (!text.includes("/") && !text.includes("?")) {
      return text;
    }

    return "";
  }
};

const getCameraErrorMessage = (err: unknown): string => {
  const error = err as {
    name?: string;
    message?: string;
  };

  const text = `${error?.name ?? ""}: ${error?.message ?? String(err)}`;

  if (!window.isSecureContext) {
    return "Kamera memerlukan HTTPS atau localhost.";
  }

  if (/NotAllowed|Permission|denied/i.test(text)) {
    return "Izin kamera ditolak. Izinkan kamera melalui pengaturan browser.";
  }

  if (/NotFound|device not found/i.test(text)) {
    return "Kamera tidak ditemukan. Periksa koneksi webcam.";
  }

  if (/NotReadable|TrackStart|Could not start video source/i.test(text)) {
    return "Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.";
  }

  if (/Overconstrained/i.test(text)) {
    return "Kamera tidak mendukung pengaturan ini. Coba kamera lain.";
  }

  return `Kamera gagal dijalankan: ${text}`;
};

function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#02060f] sm:p-4">
      <div className="relative isolate h-[100dvh] w-full max-w-[430px] overflow-hidden bg-[#050b1a] text-white sm:h-[860px] sm:max-h-[calc(100dvh-2rem)] sm:rounded-[32px] sm:border sm:border-white/10 sm:shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        {children}
      </div>
    </main>
  );
}

function RestoInnLogo() {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-blue-400/30 bg-[#071126]">
      <img
        src="/logo-restoinnApp.png"
        alt="RestoInnApp"
        className="h-full w-full object-cover"
      />
    </div>
  );
}

function QrPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="relative h-28 w-28 opacity-20">
        <div className="absolute left-0 top-0 h-9 w-9 rounded-tl-lg border-l-[4px] border-t-[4px] border-white" />
        <div className="absolute right-0 top-0 h-9 w-9 rounded-tr-lg border-r-[4px] border-t-[4px] border-white" />
        <div className="absolute bottom-0 left-0 h-9 w-9 rounded-bl-lg border-b-[4px] border-l-[4px] border-white" />
        <div className="absolute bottom-0 right-0 h-9 w-9 rounded-br-lg border-b-[4px] border-r-[4px] border-white" />
      </div>
    </div>
  );
}

export default function ScanTablePage() {
  const navigate = useNavigate();
  const { tableToken } = useParams<{ tableToken: string }>();

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const urlTokenProcessedRef = useRef(false);
  const toastTimerRef = useRef<number | null>(null);
  const onScanRef = useRef<(text: string) => void>(() => {});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [checkingSession, setCheckingSession] = useState(true);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [table, setTable] = useState<Table | null>(null);
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [urlTokenProcessing, setUrlTokenProcessing] = useState(
    Boolean(tableToken?.trim()),
  );

  const showToast = useCallback((message: string) => {
    setToast(message);

    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToast("");
      toastTimerRef.current = null;
    }, 3000);
  }, []);

  const applySession = useCallback((activeSession: CustomerSession) => {
    saveSession(activeSession);
    setSession(activeSession);

    setTable({
      tableId: activeSession.table.id,
      tableNumber: activeSession.table.tableNumber,
    });
  }, []);

  const failScan = useCallback((message: string) => {
    setError(message);
    setTable(null);
  }, []);

  const initializeCustomer = useCallback(
    async (rawTableToken: string) => {
      const normalizedToken = rawTableToken.trim();

      if (!normalizedToken) {
        failScan("QR tidak berisi kode meja yang valid.");
        processingRef.current = false;
        return;
      }

      try {
        setScannerLoading(true);
        setError("");

        const tableResult = await validateTable(normalizedToken);

        if (!tableResult?.success || !tableResult?.data) {
          failScan(
            tableResult?.message ||
              "QR meja tidak valid atau sudah tidak tersedia.",
          );
          return;
        }

        setTable(tableResult.data);

        const response = await api.post<CustomerSessionResponse>(
          "/customer-sessions/start",
          { tableToken: normalizedToken },
        );

        const body = response.data;

        if (
          !body.success ||
          !body.data?.sessionToken ||
          body.data.status !== "ACTIVE"
        ) {
          failScan(
            body.message || "Sesi meja tidak dapat dibuat. Silakan coba lagi.",
          );
          return;
        }

        applySession(body.data);

        showToast(`Meja ${body.data.table.tableNumber} berhasil dikenali`);

        window.setTimeout(() => {
          navigate("/menu", { replace: true });
        }, 500);
      } catch (err) {
        console.error("GAGAL MEMPROSES QR MEJA:", err);

        failScan(
          getApiErrorMessage(
            err,
            "QR meja tidak dapat diproses. Periksa koneksi backend dan coba lagi.",
          ),
        );
      } finally {
        setScannerLoading(false);

        if (!localStorage.getItem(SESSION_TOKEN_KEY)) {
          processingRef.current = false;
        }
      }
    },
    [applySession, failScan, navigate, showToast],
  );

  const handleQrScan = useCallback(
    (decodedText: string) => {
      if (processingRef.current) return;

      const token = extractTableToken(decodedText);

      console.log("QR TERBACA:", decodedText);

      if (!token) {
        setError("QR tidak berisi URL atau token meja yang valid.");
        return;
      }

      processingRef.current = true;
      void initializeCustomer(token);
    },
    [initializeCustomer],
  );

  onScanRef.current = handleQrScan;

  const handleUploadQr = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const file = input.files?.[0];

      if (!file) return;

      if (!file.type.startsWith("image/")) {
        setError("Pilih file gambar yang berisi QR Code.");
        input.value = "";
        return;
      }

      if (processingRef.current || uploadLoading) {
        input.value = "";
        return;
      }

      setUploadLoading(true);
      setError("");

      let fileScanner: Html5Qrcode | null = null;

      try {
        fileScanner = new Html5Qrcode(FILE_READER_ID, {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        });

        const decodedText = await fileScanner.scanFile(file, false);

        handleQrScan(decodedText);
      } catch (err) {
        console.error("GAGAL MEMBACA QR DARI GALERI:", err);

        processingRef.current = false;

        setError(
          "QR tidak terbaca dari gambar. Pastikan gambar tidak buram dan QR terlihat utuh.",
        );
      } finally {
        try {
          fileScanner?.clear();
        } catch (cleanupError) {
          console.warn("Gagal membersihkan pembaca QR:", cleanupError);
        }

        setUploadLoading(false);
        input.value = "";
      }
    },
    [handleQrScan, uploadLoading],
  );

  const dismissError = () => {
    setError("");
    processingRef.current = false;
  };

  const handleRetryCamera = () => {
    setCameraError("");
    setCameraReady(false);
    setTorchEnabled(false);
    setTorchSupported(false);
    setError("");
    processingRef.current = false;
    setRetryKey((value) => value + 1);
  };

  const toggleTorch = async () => {
    const scanner = scannerRef.current;

    if (!scanner || !cameraReady) return;

    try {
      const capabilities = scanner.getRunningTrackCameraCapabilities();
      const torchFeature = capabilities.torchFeature();

      if (!torchFeature.isSupported()) {
        setTorchSupported(false);
        showToast("Lampu flash tidak didukung kamera ini.");
        return;
      }

      const nextValue = !torchEnabled;

      await torchFeature.apply(nextValue);
      setTorchEnabled(nextValue);
    } catch (err) {
      console.error("GAGAL MENGUBAH FLASH:", err);
      setTorchSupported(false);
      showToast("Lampu flash tidak dapat digunakan.");
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  // ==========================================
  // RESET HALAMAN JIKA SESI DIAKHIRI
  // ==========================================

  useEffect(() => {
    const handleSessionEnded = () => {
      clearStoredSession();

      setSession(null);
      setTable(null);
      setError("");
      setToast("");
      setTorchEnabled(false);
      setTorchSupported(false);
      setCameraReady(false);

      processingRef.current = false;

      if (tableToken?.trim()) {
        navigate("/scan", { replace: true });
      }
    };

    window.addEventListener("customer-session-ended", handleSessionEnded);

    return () => {
      window.removeEventListener("customer-session-ended", handleSessionEnded);
    };
  }, [navigate, tableToken]);

  // ==========================================
  // PERIKSA SESI TERSIMPAN
  // ==========================================

  useEffect(() => {
    let mounted = true;

    const checkSavedSession = async () => {
      if (tableToken?.trim()) {
        if (mounted) setCheckingSession(false);
        return;
      }

      const savedToken = localStorage.getItem(SESSION_TOKEN_KEY);

      if (!savedToken) {
        if (mounted) setCheckingSession(false);
        return;
      }

      try {
        const response = await api.get<CustomerSessionResponse>(
          `/customer-sessions/${encodeURIComponent(savedToken)}`,
        );

        const body = response.data;

        if (
          body.success &&
          body.data?.status === "ACTIVE" &&
          body.data.sessionToken
        ) {
          if (!mounted) return;

          applySession(body.data);
          navigate("/menu", { replace: true });
          return;
        }

        clearStoredSession();
      } catch (err) {
        console.error("GAGAL MEMERIKSA SESI TERSIMPAN:", err);

        const status = (
          err as {
            response?: {
              status?: number;
            };
          }
        )?.response?.status;

        // Jangan hapus sesi karena gangguan jaringan sementara.
        if ([400, 401, 404].includes(status ?? 0)) {
          clearStoredSession();
        }
      } finally {
        if (mounted) setCheckingSession(false);
      }
    };

    void checkSavedSession();

    return () => {
      mounted = false;
    };
  }, [applySession, navigate, tableToken]);

  // ==========================================
  // PROSES TOKEN DARI URL QR
  // ==========================================

  useEffect(() => {
    if (checkingSession || urlTokenProcessedRef.current) return;

    const token = tableToken?.trim();

    if (!token) {
      setUrlTokenProcessing(false);
      return;
    }

    urlTokenProcessedRef.current = true;
    processingRef.current = true;
    setUrlTokenProcessing(true);

    void initializeCustomer(token).finally(() => {
      setUrlTokenProcessing(false);
    });
  }, [checkingSession, tableToken, initializeCustomer]);

  // ==========================================
  // INISIALISASI KAMERA
  // ==========================================

  useEffect(() => {
    if (
      checkingSession ||
      session ||
      urlTokenProcessing ||
      tableToken?.trim()
    ) {
      return;
    }

    let cancelled = false;
    let activeScanner: Html5Qrcode | null = null;

    const startScanner = async () => {
      try {
        setScannerLoading(true);
        setCameraError("");
        setCameraReady(false);
        setTorchEnabled(false);
        setTorchSupported(false);

        if (!window.isSecureContext) {
          throw new Error(
            "InsecureContextError: Kamera memerlukan HTTPS atau localhost.",
          );
        }

        const cameras = await Html5Qrcode.getCameras();

        if (cancelled) return;

        if (!cameras.length) {
          throw new Error("NotFoundError: Kamera tidak ditemukan.");
        }

        console.log(
          "KAMERA TERSEDIA:",
          cameras.map((camera) => ({
            id: camera.id,
            label: camera.label,
          })),
        );

        const preferredCamera =
          cameras.find((camera) =>
            /webcam|integrated|built.?in|front|user/i.test(camera.label),
          ) ?? cameras[0];

        const scanner = new Html5Qrcode(READER_ID, {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        });

        activeScanner = scanner;
        scannerRef.current = scanner;

        const scanConfig = {
          fps: 15,
          qrbox: (width: number, height: number) => {
            const smallestSide = Math.min(width, height);
            const size = Math.max(120, Math.min(smallestSide * 0.8, 320));

            return {
              width: Math.floor(Math.min(size, width)),
              height: Math.floor(Math.min(size, height)),
            };
          },
          aspectRatio: 1,
          disableFlip: false,
        };

        const startWithCamera = async (cameraId: string) => {
          await scanner.start(
            cameraId,
            scanConfig,
            (decodedText) => {
              if (cancelled || processingRef.current) return;
              onScanRef.current(decodedText);
            },
            () => {
              // Frame tanpa QR adalah kondisi normal.
            },
          );
        };

        try {
          await startWithCamera(preferredCamera.id);
        } catch (firstError) {
          if (cancelled || cameras.length < 2) {
            throw firstError;
          }

          const alternativeCamera = cameras.find(
            (camera) => camera.id !== preferredCamera.id,
          );

          if (!alternativeCamera) throw firstError;

          console.warn("Mencoba kamera alternatif:", firstError);

          await startWithCamera(alternativeCamera.id);
        }

        if (cancelled) {
          try {
            await scanner.stop();
          } catch {
            // Kamera mungkin belum berjalan.
          }

          try {
            scanner.clear();
          } catch {
            // Scanner sudah dibersihkan.
          }

          return;
        }

        setCameraReady(true);

        try {
          const capabilities = scanner.getRunningTrackCameraCapabilities();

          setTorchSupported(capabilities.torchFeature().isSupported());
        } catch {
          setTorchSupported(false);
        }
      } catch (err) {
        console.error("GAGAL MEMULAI SCANNER:", err);

        if (!cancelled) {
          setCameraError(getCameraErrorMessage(err));
          setCameraReady(false);
          setTorchSupported(false);
        }
      } finally {
        if (!cancelled) {
          setScannerLoading(false);
        }
      }
    };

    void startScanner();

    return () => {
      cancelled = true;

      const scanner = activeScanner;

      if (scannerRef.current === scanner) {
        scannerRef.current = null;
      }

      if (scanner) {
        void (async () => {
          try {
            if (scanner.isScanning) {
              await scanner.stop();
            }
          } catch (err) {
            console.warn("GAGAL MENGHENTIKAN SCANNER:", err);
          }

          try {
            scanner.clear();
          } catch {
            // Scanner sudah dibersihkan.
          }
        })();
      }
    };
  }, [checkingSession, session, urlTokenProcessing, retryKey, tableToken]);

  // Bersihkan timer toast saat komponen dilepas.
  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  return (
    <PhoneShell>
      <div className="absolute inset-0 overflow-hidden bg-[#050b1a]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(37,99,235,0.16),transparent_48%)]" />

        <div
          id={READER_ID}
          className="absolute inset-0 z-0 h-full w-full overflow-hidden"
        />

        <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.86)_0%,rgba(2,6,23,0.28)_32%,rgba(2,6,23,0.12)_55%,rgba(2,6,23,0.86)_100%)]" />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-40 bg-gradient-to-b from-[#020617]/95 to-transparent" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-72 bg-gradient-to-t from-[#020617]/95 via-[#020617]/70 to-transparent" />
      </div>

      <div
        id={FILE_READER_ID}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-hidden opacity-0"
      />

      <header className="absolute inset-x-0 top-0 z-40 flex h-19 items-center justify-between px-5 pt-2">
        <button
          type="button"
          onClick={handleBack}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white backdrop-blur-xl transition active:scale-95"
          aria-label="Kembali"
        >
          <FiArrowLeft size={18} />
        </button>

        <div className="text-center">
          <p className="text-[9px] font-semibold tracking-[0.24em] text-blue-300">
            DINE-IN
          </p>
          <p className="mt-1 text-[14px] font-bold leading-none text-white">
            Pindai kode QR
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            showToast("Arahkan kamera ke QR yang tersedia di meja.")
          }
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white backdrop-blur-xl transition active:scale-95"
          aria-label="Bantuan"
        >
          <FiHelpCircle size={17} />
        </button>
      </header>

      <section className="absolute inset-x-0 top-24 z-30 px-6 text-center">
        <div className="mx-auto max-w-[320px]">
          <h1 className="text-[21px] font-semibold leading-[1.18] tracking-tight text-white">
            Arahkan ke kode QR di meja
          </h1>

          <p className="mx-auto mt-3 max-w-72 text-[12px] leading-[1.55] text-white/55">
            Pastikan kode QR terlihat jelas dan berada di dalam kotak pemindai.
          </p>
        </div>
      </section>

      <section className="absolute left-1/2 top-[49%] z-30 h-62 w-62 -translate-x-1/2 -translate-y-1/2 sm:h-70 sm:w-70">
        {CORNERS.map((corner) => (
          <span
            key={corner}
            className={`absolute h-11 w-11 border-blue-400 ${corner}`}
          />
        ))}

        <div className="pointer-events-none absolute inset-x-4 top-1/2 h-px -translate-y-1/2 overflow-hidden">
          <div className="absolute h-px w-full animate-[scanline_2.2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_12px_rgba(59,130,246,0.9)]" />
        </div>

        {!cameraReady && (
          <div className="absolute inset-4 overflow-hidden rounded-[20px] bg-black/10">
            <QrPlaceholder />
          </div>
        )}

        {scannerLoading && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center rounded-[24px] bg-black/20 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-4 py-2 text-[11px] text-white/80 backdrop-blur-xl">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
              Menyiapkan kamera...
            </div>
          </div>
        )}
      </section>

      <section className="absolute left-1/2 top-[70%] z-30 -translate-x-1/2">
        {cameraReady && torchSupported && (
          <button
            type="button"
            onClick={() => void toggleTorch()}
            className={`flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-xl transition active:scale-95 ${
              torchEnabled
                ? "border-blue-400/50 bg-blue-500/20 text-blue-300"
                : "border-white/10 bg-black/40 text-white/75"
            }`}
            aria-label="Lampu kamera"
          >
            <FiZap size={17} className={torchEnabled ? "fill-current" : ""} />
          </button>
        )}

        {cameraError && (
          <div className="w-[280px] rounded-2xl border border-red-400/15 bg-black/60 p-4 text-center backdrop-blur-xl">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-300">
              <FiCamera />
            </div>

            <p className="mt-3 text-[11px] leading-5 text-white/70">
              {cameraError}
            </p>

            <button
              type="button"
              onClick={handleRetryCamera}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-[11px] font-medium text-white transition active:scale-95"
            >
              <FiRefreshCw size={13} />
              Coba lagi
            </button>
          </div>
        )}
      </section>

      {toast && (
        <div className="absolute left-1/2 top-[76%] z-50 w-[calc(100%-40px)] -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl border border-blue-400/20 bg-[#071326]/95 px-4 py-3 shadow-xl backdrop-blur-xl">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-300">
              <FiCheck />
            </div>
            <p className="text-xs font-medium text-white">{toast}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-x-5 top-1/2 z-[60] -translate-y-1/2">
          <div className="rounded-[24px] border border-white/10 bg-[#07101f]/95 p-5 text-center shadow-2xl backdrop-blur-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-300">
              <FiLock />
            </div>

            <h2 className="mt-4 text-base font-semibold text-white">
              QR tidak dapat diproses
            </h2>

            <p className="mt-2 break-words text-xs leading-5 text-white/65">
              {error}
            </p>

            <button
              type="button"
              onClick={dismissError}
              className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-[0.98]"
            >
              Scan lagi
            </button>
          </div>
        </div>
      )}

      <footer className="absolute inset-x-0 bottom-0 z-40 px-4 pb-[max(14px,env(safe-area-inset-bottom))]">
        <div className="mb-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUploadQr}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadLoading || scannerLoading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-400/25 bg-[#0b1730]/95 px-4 py-3.5 text-sm font-semibold text-white shadow-lg backdrop-blur-xl transition hover:bg-blue-950/80 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploadLoading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Membaca QR...
              </>
            ) : (
              <>
                <FiImage size={17} className="text-blue-300" />
                Upload QR dari Galeri
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0b1226]/95 p-3 shadow-[0_-15px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl">
          <RestoInnLogo />

          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-extrabold leading-tight text-white">
              RestoInnApp
            </p>
            <p className="mt-1 truncate text-[9px] font-medium tracking-[0.12em] text-white/40">
              CUSTOMER APP
            </p>
          </div>

          <div className="min-w-[58px] rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-center">
            <p className="text-[8px] font-semibold uppercase tracking-wide text-white/40">
              Meja
            </p>
            <p className="mt-0.5 text-[18px] font-black leading-none text-white">
              {table ? table.tableNumber : "—"}
            </p>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-center gap-1.5">
          <FiLock size={8} className="text-white/25" />
          <p className="text-[9px] text-white/25">
            Scan QR untuk mulai memesan
          </p>
        </div>
      </footer>

      <style>{`
        #${READER_ID} {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          overflow: hidden !important;
          border: 0 !important;
          background: transparent !important;
        }

        #${READER_ID} video {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border: 0 !important;
        }

        #${READER_ID} canvas {
          max-width: 100%;
        }

        #${READER_ID}__scan_region {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
        }

        #${READER_ID}__scan_region img {
          display: none !important;
        }

        #${READER_ID}__dashboard,
        #${READER_ID}__dashboard_section,
        #${READER_ID}__dashboard_section_csr,
        #${READER_ID}__header_message,
        #${READER_ID}__camera_selection {
          display: none !important;
        }

        @keyframes scanline {
          0%, 100% {
            transform: translateY(-105px);
            opacity: 0;
          }

          15% {
            opacity: 1;
          }

          50% {
            transform: translateY(105px);
            opacity: 1;
          }

          85% {
            opacity: 1;
          }
        }
      `}</style>
    </PhoneShell>
  );
}
