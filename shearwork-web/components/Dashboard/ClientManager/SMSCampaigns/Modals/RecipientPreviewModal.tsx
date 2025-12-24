import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Users,
  Search,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabaseClient";
import toast from "react-hot-toast";

interface PreviewClient {
  client_id: string;
  first_name: string | null;
  last_name: string | null;
  phone_normalized: string;
  visiting_type: string | null;
  avg_weekly_visits: number | null;
  last_appt: string | null;
  total_appointments: number;
  days_since_last_visit: number;
  days_overdue: number;
  expected_visit_interval_days: number;
  score: number;
  date_last_sms_sent: string | null;
}

interface PreviewStats {
  total_selected: number;
  breakdown: Record<string, number>;
  avg_score: string;
  avg_days_overdue: string;
  avg_days_since_last_visit: string;
}

interface AllClient {
  client_id: string;
  first_name: string | null;
  last_name: string | null;
  phone_normalized: string | null;
  email: string | null;
  phone: string | null;
  last_appt: string | null;
  total_appointments: number;
}

interface RecipientPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageTitle: string;
  messageId: string | null;
  previewClients: PreviewClient[];
  previewStats: PreviewStats | null;
  maxClients: number;
}

type TabType = "client-list" | "selected" | "deselected";

export default function RecipientPreviewModal({
  isOpen,
  onClose,
  messageTitle,
  messageId,
  previewClients,
  previewStats,
  maxClients,
}: RecipientPreviewModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("client-list");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [deselectedClients, setDeselectedClients] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<any[]>([]);

  // All clients pagination
  const [allClients, setAllClients] = useState<AllClient[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingAllClients, setLoadingAllClients] = useState(false);

  const [showDeselectModal, setShowDeselectModal] = useState(false);
  const [showReselectModal, setShowReselectModal] = useState(false);
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [showUnselectModal, setShowUnselectModal] = useState(false);

  const [pendingDeselectPhone, setPendingDeselectPhone] = useState<
    string | null
  >(null);
  const [pendingDeselectName, setPendingDeselectName] = useState<string>("");
  const [pendingReselectPhone, setPendingReselectPhone] = useState<
    string | null
  >(null);
  const [pendingReselectName, setPendingReselectName] = useState<string>("");
  const [pendingSelectClient, setPendingSelectClient] = useState<any | null>(
    null,
  );
  const [pendingUnselectClient, setPendingUnselectClient] = useState<
    any | null
  >(null);

  const [clientListPage, setClientListPage] = useState(1);
  const [clientListTotalPages, setClientListTotalPages] = useState(1);
  const CLIENT_LIST_PER_PAGE = 100;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      if (activeTab === "selected") {
        setCurrentPage(1); // Reset to page 1 on search
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, activeTab]);

  // Load deselected and selected clients when modal opens
  useEffect(() => {
    if (isOpen && messageId) {
      loadDeselectedClients();
      loadSelectedClients();
    }
  }, [isOpen, messageId]);

  // Load all clients when on selected tab
  useEffect(() => {
    if (activeTab === "selected") {
      loadAllClients();
    }
  }, [activeTab, currentPage, debouncedSearch]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab("client-list");
      setSearchQuery("");
      setDebouncedSearch("");
      setCurrentPage(1);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setActiveTab("client-list");
      setSearchQuery("");
      setDebouncedSearch("");
      setCurrentPage(1);
      setClientListPage(1); // Add this line
    }
  }, [isOpen]);

  // Add this useEffect after your other useEffects
  useEffect(() => {
    if (activeTab === "client-list") {
      const selectedPhones = new Set(
        selectedClients.map((c) => c.phone_normalized),
      );

      const filteredPreview = previewClients.filter((client) => {
        const isDeselected = deselectedClients.includes(client.phone_normalized);

        if (debouncedSearch) {
          const search = debouncedSearch.toLowerCase();
          const fullName = `${client.first_name || ""} ${client.last_name || ""}`.toLowerCase();
          const phone = client.phone_normalized.toLowerCase();
          const matchesSearch = fullName.includes(search) || phone.includes(search);
          return !isDeselected && matchesSearch;
        }

        return !isDeselected;
      });

      const selectedFromPreview = filteredPreview.filter((c) =>
        selectedPhones.has(c.phone_normalized),
      );
      const notSelected = filteredPreview.filter(
        (c) => !selectedPhones.has(c.phone_normalized),
      );

      const allFilteredClients = [...selectedFromPreview, ...notSelected];
      const totalPages = Math.max(1, Math.ceil(allFilteredClients.length / CLIENT_LIST_PER_PAGE));
      
      setClientListTotalPages(totalPages);
    }
  }, [activeTab, previewClients, deselectedClients, selectedClients, debouncedSearch, CLIENT_LIST_PER_PAGE]);

  const loadDeselectedClients = async () => {
    if (!messageId) return;

    try {
      const { data, error } = await supabase
        .from("sms_scheduled_messages")
        .select("deselected_clients")
        .eq("id", messageId)
        .maybeSingle(); // Use maybeSingle() instead of single()

      if (error) throw error;

      setDeselectedClients(data?.deselected_clients || []);
    } catch (error) {
      console.error("Failed to load deselected clients:", error);
      // Don't show error to user for new messages
    }
  };

  const loadSelectedClients = async () => {
    if (!messageId) return;

    try {
      const { data, error } = await supabase
        .from("sms_scheduled_messages")
        .select("selected_clients")
        .eq("id", messageId)
        .maybeSingle();

      if (error) throw error;

      setSelectedClients(data?.selected_clients || []);
    } catch (error) {
      console.error("Failed to load selected clients:", error);
    }
  };

  const loadAllClients = async () => {
    setLoadingAllClients(true);
    try {
      // Get all phone numbers from preview clients (client list) to exclude
      const excludePhones = previewClients.map((c) => c.phone_normalized);

      const response = await fetch(
        `/api/client-manager/clients?page=${currentPage}&limit=100&search=${encodeURIComponent(debouncedSearch)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exclude: excludePhones
          })
        }
      );

      if (!response.ok) throw new Error("Failed to load clients");

      const data = await response.json();

      // Clients are already filtered by the API
      const clients = data.clients || [];

      const selectedPhones = new Set(
        selectedClients.map((c) => c.phone_normalized),
      );

      // Sort with selected clients at the top
      const sortedClients = [
        ...clients.filter((c: AllClient) =>
          selectedPhones.has(c.phone_normalized || ""),
        ),
        ...clients.filter(
          (c: AllClient) => !selectedPhones.has(c.phone_normalized || ""),
        ),
      ];

      setAllClients(sortedClients);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error("Failed to load all clients:", error);
      toast.error("Failed to load clients");
    } finally {
      setLoadingAllClients(false);
    }
  };

  // Add this helper function near the top of your component, after the state declarations
  const checkMessageExistsInDatabase = async (): Promise<boolean> => {
    if (!messageId) {
      toast.error("Please save this message as a draft first");
      return false;
    }

    try {
      const { data, error } = await supabase
        .from("sms_scheduled_messages")
        .select("id")
        .eq("id", messageId)
        .maybeSingle();

      if (error || !data) {
        toast.error("Please save this message as a draft first");
        return false;
      }

      return true;
    } catch (error) {
      toast.error("Please save this message as a draft first");
      return false;
    }
  };

  // Then update your handler functions to use it:
  const handleDeselectRequest = async (phone: string, name: string) => {
    if (!(await checkMessageExistsInDatabase())) return;
    
    setPendingDeselectPhone(phone);
    setPendingDeselectName(name);
    setShowDeselectModal(true);
  };

  const handleReselectRequest = async (phone: string, name: string) => {
    if (!(await checkMessageExistsInDatabase())) return;
    
    setPendingReselectPhone(phone);
    setPendingReselectName(name);
    setShowReselectModal(true);
  };

  const handleSelectRequest = async (client: AllClient) => {
    if (!(await checkMessageExistsInDatabase())) return;
    
    setPendingSelectClient(client);
    setShowSelectModal(true);
  };

  const handleUnselectRequest = async (client: any) => {
    if (!(await checkMessageExistsInDatabase())) return;
    
    setPendingUnselectClient(client);
    setShowUnselectModal(true);
  };

  const confirmDeselect = async () => {
    if (!pendingDeselectPhone || !messageId) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const updatedDeselected = [...deselectedClients, pendingDeselectPhone];

      const { error } = await supabase
        .from("sms_scheduled_messages")
        .update({ deselected_clients: updatedDeselected })
        .eq("id", messageId)
        .eq("user_id", user.id);

      if (error) throw error;

      setDeselectedClients(updatedDeselected);
      toast.success("Client moved to deselected list");
    } catch (error) {
      console.error("Failed to deselect client:", error);
      toast.error("Failed to deselect client");
    } finally {
      setShowDeselectModal(false);
      setPendingDeselectPhone(null);
      setPendingDeselectName("");
    }
  };

  const confirmReselect = async () => {
    if (!pendingReselectPhone || !messageId) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const updatedDeselected = deselectedClients.filter(
        (phone) => phone !== pendingReselectPhone,
      );

      const { error } = await supabase
        .from("sms_scheduled_messages")
        .update({ deselected_clients: updatedDeselected })
        .eq("id", messageId)
        .eq("user_id", user.id);

      if (error) throw error;

      setDeselectedClients(updatedDeselected);
      toast.success("Client removed from deselected list");
    } catch (error) {
      console.error("Failed to reselect client:", error);
      toast.error("Failed to reselect client");
    } finally {
      setShowReselectModal(false);
      setPendingReselectPhone(null);
      setPendingReselectName("");
    }
  };

  const confirmSelect = async () => {
    if (!pendingSelectClient || !messageId) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const clientToAdd = {
        client_id: pendingSelectClient.client_id,
        first_name: pendingSelectClient.first_name,
        last_name: pendingSelectClient.last_name,
        phone_normalized: pendingSelectClient.phone_normalized,
      };

      const updatedSelected = [...selectedClients, clientToAdd];

      const { error } = await supabase
        .from("sms_scheduled_messages")
        .update({ selected_clients: updatedSelected })
        .eq("id", messageId)
        .eq("user_id", user.id);

      if (error) throw error;

      setSelectedClients(updatedSelected);

      // Reload the selected clients tab to show the new client at the top
      if (activeTab === "selected") {
        loadAllClients();
      }

      toast.success("Client added to selected list");
    } catch (error) {
      console.error("Failed to select client:", error);
      toast.error("Failed to select client");
    } finally {
      setShowSelectModal(false);
      setPendingSelectClient(null);
    }
  };

  const confirmUnselect = async () => {
    if (!pendingUnselectClient || !messageId) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const updatedSelected = selectedClients.filter(
        (c) => c.phone_normalized !== pendingUnselectClient.phone_normalized,
      );

      const { error } = await supabase
        .from("sms_scheduled_messages")
        .update({ selected_clients: updatedSelected })
        .eq("id", messageId)
        .eq("user_id", user.id);

      if (error) throw error;

      setSelectedClients(updatedSelected);

      // Reload the selected clients tab to update the order
      if (activeTab === "selected") {
        loadAllClients();
      }

      toast.success("Client removed from selected list");
    } catch (error) {
      console.error("Failed to unselect client:", error);
      toast.error("Failed to unselect client");
    } finally {
      setShowUnselectModal(false);
      setPendingUnselectClient(null);
    }
  };

  // Filter clients based on search and deselection
  const getFilteredClients = () => {
    // Combine selected clients with preview clients for client list
    if (activeTab === "client-list") {
      // First, get selected clients that match preview client structure
      const selectedPhones = new Set(
        selectedClients.map((c) => c.phone_normalized),
      );

      // Filter preview clients to exclude deselected
      const filteredPreview = previewClients.filter((client) => {
        const isDeselected = deselectedClients.includes(
          client.phone_normalized,
        );

        // Apply search filter
        if (debouncedSearch) {
          const search = debouncedSearch.toLowerCase();
          const fullName =
            `${client.first_name || ""} ${client.last_name || ""}`.toLowerCase();
          const phone = client.phone_normalized.toLowerCase();

          const matchesSearch =
            fullName.includes(search) || phone.includes(search);
          return !isDeselected && matchesSearch;
        }

        return !isDeselected;
      });

      // Put selected clients at the top
      const selectedFromPreview = filteredPreview.filter((c) =>
        selectedPhones.has(c.phone_normalized),
      );
      const notSelected = filteredPreview.filter(
        (c) => !selectedPhones.has(c.phone_normalized),
      );

      const allFilteredClients = [...selectedFromPreview, ...notSelected];
      
      // Return paginated results
      const start = (clientListPage - 1) * CLIENT_LIST_PER_PAGE;
      return allFilteredClients.slice(start, start + CLIENT_LIST_PER_PAGE);
    }

    // For selected tab, filter all clients
    if (activeTab === "selected") {
      return allClients;
    }

    // For deselected tab
    if (activeTab === "deselected") {
      return previewClients.filter((client) => {
        if (!deselectedClients.includes(client.phone_normalized)) {
          return false;
        }

        // Apply search filter
        if (debouncedSearch) {
          const search = debouncedSearch.toLowerCase();
          const fullName =
            `${client.first_name || ""} ${client.last_name || ""}`.toLowerCase();
          const phone = client.phone_normalized.toLowerCase();

          return fullName.includes(search) || phone.includes(search);
        }

        return true;
      });
    }

    return [];
  };

  const filteredClients = getFilteredClients();
  const activeClientCount =
    previewClients.length - deselectedClients.length + selectedClients.length;

  const isClientSelected = (phone: string | null) => {
    if (!phone) return false;
    return selectedClients.some((c) => c.phone_normalized === phone);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-4xl w-full min-h-[90vh] max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10 flex-shrink-0">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-sky-300" />
                  Recipients for {messageTitle}
                </h3>
                {previewStats && (
                  <p className="text-sm text-[#bdbdbd] mt-1">
                    {activeClientCount} active clients •{" "}
                    {selectedClients.length} manually selected •{" "}
                    {deselectedClients.length} deselected • Max: {maxClients}
                  </p>
                )}
              </div>

              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors ml-4"
              >
                <X className="w-5 h-5 text-[#bdbdbd]" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10 px-6 flex-shrink-0">
              <button
                onClick={() => setActiveTab("client-list")}
                className={`px-4 py-3 text-sm font-semibold transition-all relative ${
                  activeTab === "client-list"
                    ? "text-sky-300"
                    : "text-[#bdbdbd] hover:text-white"
                }`}
              >
                Client List
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-white/10">
                  {activeClientCount}
                </span>
                {activeTab === "client-list" && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-300"
                  />
                )}
              </button>

              <button
                onClick={() => setActiveTab("selected")}
                className={`px-4 py-3 text-sm font-semibold transition-all relative ${
                  activeTab === "selected"
                    ? "text-sky-300"
                    : "text-[#bdbdbd] hover:text-white"
                }`}
              >
                Deselected Clients
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-white/10">
                  {selectedClients.length}
                </span>
                {activeTab === "selected" && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-300"
                  />
                )}
              </button>

              <button
                onClick={() => setActiveTab("deselected")}
                className={`px-4 py-3 text-sm font-semibold transition-all relative ${
                  activeTab === "deselected"
                    ? "text-sky-300"
                    : "text-[#bdbdbd] hover:text-white"
                }`}
              >
                Deselected Clients
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-white/10">
                  {deselectedClients.length}
                </span>
                {activeTab === "deselected" && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-300"
                  />
                )}
              </button>
            </div>

            {/* Stats - Only show on Client List tab */}
            {previewStats && activeTab === "client-list" && (
              <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex-shrink-0">
                <div className="flex items-center justify-between gap-6">
                  <div className="flex gap-6">
                    <div>
                      <p className="text-xs text-[#bdbdbd] mb-0.5">
                        Total Selected
                      </p>
                      <p className="text-xl font-bold text-white">
                        {activeClientCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#bdbdbd] mb-0.5">Avg Score</p>
                      <p className="text-xl font-bold text-sky-300">
                        {previewStats.avg_score}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#bdbdbd] mb-0.5">
                        Avg Days Since Visit
                      </p>
                      <p className="text-xl font-bold text-purple-400">
                        {previewStats.avg_days_since_last_visit}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#bdbdbd] mb-0.5">
                        Avg Days Overdue
                      </p>
                      <p className="text-xl font-bold text-orange-400">
                        {previewStats.avg_days_overdue}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Metric Explanations */}
                <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5 text-xs text-[#bdbdbd]">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    <div>
                      <span className="text-sky-300 font-medium">Score:</span>{" "}
                      Higher = client needs message more urgently
                    </div>
                    <div>
                      <span className="text-purple-400 font-medium">
                        Days Since Visit:
                      </span>{" "}
                      Days since last appointment
                    </div>
                    <div>
                      <span className="text-orange-400 font-medium">
                        Days Overdue:
                      </span>{" "}
                      How late based on their typical pattern
                    </div>
                  </div>

                  {/* Client Types Legend */}
                  <div className="flex flex-wrap gap-3 pt-2">
                    {previewStats.breakdown.consistent > 0 && (
                      <span className="bg-green-500/10 text-green-400 px-2 py-0.5 rounded text-[11px] flex items-center gap-1.5">
                        <span className="font-medium">Consistent:</span> Weekly
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/20">
                          {previewStats.breakdown.consistent}
                        </span>
                      </span>
                    )}
                    {previewStats.breakdown["semi-consistent"] > 0 && (
                      <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-[11px] flex items-center gap-1.5">
                        <span className="font-medium">Semi-consistent:</span>{" "}
                        Every 2-3 weeks
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20">
                          {previewStats.breakdown["semi-consistent"]}
                        </span>
                      </span>
                    )}
                    {previewStats.breakdown["easy-going"] > 0 && (
                      <span className="bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded text-[11px] flex items-center gap-1.5">
                        <span className="font-medium">Easy-going:</span> Every
                        1-2 months
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-500/20">
                          {previewStats.breakdown["easy-going"]}
                        </span>
                      </span>
                    )}
                    {previewStats.breakdown.rare > 0 && (
                      <span className="bg-red-500/10 text-red-400 px-2 py-0.5 rounded text-[11px] flex items-center gap-1.5">
                        <span className="font-medium">Rare:</span> Every 2+
                        months
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/20">
                          {previewStats.breakdown.rare}
                        </span>
                      </span>
                    )}
                    {previewStats.breakdown.new > 0 && (
                      <span className="bg-gray-500/10 text-gray-400 px-2 py-0.5 rounded text-[11px] flex items-center gap-1.5">
                        <span className="font-medium">New:</span> First visit
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-500/20">
                          {previewStats.breakdown.new}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Search Bar */}
            <div className="p-4 border-b border-white/10 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#bdbdbd]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or phone number..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder-[#bdbdbd]/50 focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all"
                />
              </div>
            </div>

            {/* Clients List */}
            <div className="overflow-y-auto flex-1 relative">
              {/* Sticky Pagination - Client List */}
              {activeTab === "client-list" && clientListTotalPages > 1 && (
                <div className="sticky top-0 z-10 bg-[#1a1a1a] border-b border-white/10 px-6 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#bdbdbd]">
                      Page {clientListPage} of {clientListTotalPages} • {filteredClients.length} client{filteredClients.length !== 1 ? "s" : ""} on this page
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setClientListPage((p) => Math.max(1, p - 1))}
                        disabled={clientListPage === 1}
                        className="p-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setClientListPage((p) => Math.min(clientListTotalPages, p + 1))}
                        disabled={clientListPage === clientListTotalPages}
                        className="p-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Sticky Pagination - Selected Clients */}
              {activeTab === "selected" && totalPages > 1 && (
                <div className="sticky top-0 z-10 bg-[#1a1a1a] border-b border-white/10 px-6 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#bdbdbd]">
                      Page {currentPage} of {totalPages} • {allClients.length} client{allClients.length !== 1 ? "s" : ""} on this page
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-6">
                {loadingAllClients && activeTab === "selected" ? (
                  <div className="text-center py-12">
                    <div className="w-8 h-8 border-2 border-sky-300 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-[#bdbdbd]">Loading clients...</p>
                  </div>
                ) : filteredClients.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-[#bdbdbd] mx-auto mb-4 opacity-50" />
                    <p className="text-[#bdbdbd]">
                      {debouncedSearch
                        ? "No clients found matching your search"
                        : activeTab === "deselected"
                          ? "No deselected clients yet"
                          : activeTab === "selected"
                            ? "No clients found"
                            : "No clients in this list"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Render based on tab */}
                    {activeTab === "client-list" &&
                      filteredClients.map((client: any) => {
                        const normalVisitInterval = client.avg_weekly_visits
                          ? Math.round(7 / client.avg_weekly_visits)
                          : null;

                        const isDeselected = deselectedClients.includes(
                          client.phone_normalized,
                        );
                        const isSelected = isClientSelected(
                          client.phone_normalized,
                        );

                        return (
                          <div
                            key={client.client_id}
                            className={`flex items-center gap-4 p-4 border rounded-xl hover:bg-white/10 transition-colors ${
                              isSelected
                                ? "bg-sky-300/10 border-sky-300/30"
                                : "bg-white/5 border-white/10"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={!isDeselected}
                              onChange={() => {
                                if (!isDeselected) {
                                  handleDeselectRequest(
                                    client.phone_normalized,
                                    `${client.first_name || ""} ${client.last_name || ""}`.trim() ||
                                      "Unknown Client",
                                  );
                                }
                              }}
                              className="w-4 h-4 rounded border-white/20 bg-white/5 text-sky-300 focus:ring-2 focus:ring-sky-300/50 cursor-pointer"
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3">
                                <h4 className="font-semibold text-white">
                                  {client.first_name} {client.last_name}
                                </h4>
                                {isSelected && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-300/20 text-sky-300 border border-sky-300/30">
                                    Manually Selected
                                  </span>
                                )}
                                <span
                                  className={`text-xs px-2 py-1 rounded-full ${
                                    client.visiting_type === "consistent"
                                      ? "bg-green-500/20 text-green-400"
                                      : client.visiting_type ===
                                          "semi-consistent"
                                        ? "bg-blue-500/20 text-blue-400"
                                        : client.visiting_type === "easy-going"
                                          ? "bg-yellow-500/20 text-yellow-400"
                                          : client.visiting_type === "rare"
                                            ? "bg-red-500/20 text-red-400"
                                            : "bg-gray-500/20 text-gray-400"
                                  }`}
                                >
                                  {client.visiting_type}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-xs text-[#bdbdbd]">
                                <span>{client.phone_normalized}</span>
                                <span>•</span>
                                <span>
                                  {client.days_since_last_visit} days since last
                                  visit
                                </span>
                                <span>•</span>
                                <span className="text-orange-400">
                                  {client.days_overdue} days overdue
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-sky-300">
                                Score: {client.score}
                              </p>
                              {normalVisitInterval && (
                                <p className="text-xs text-[#bdbdbd]">
                                  Goes every ~{normalVisitInterval} days
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}

                    {/* Selected tab - all clients from API */}
                    {activeTab === "selected" &&
                      allClients.map((client) => {
                        const isSelected = isClientSelected(
                          client.phone_normalized,
                        );

                        return (
                          <div
                            key={client.client_id}
                            className={`flex items-center gap-4 p-4 border rounded-xl hover:bg-white/10 transition-colors ${
                              isSelected
                                ? "bg-sky-300/10 border-sky-300/30"
                                : "bg-white/5 border-white/10"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                if (isSelected) {
                                  handleUnselectRequest(
                                    selectedClients.find(
                                      (c) =>
                                        c.phone_normalized ===
                                        client.phone_normalized,
                                    ),
                                  );
                                } else {
                                  handleSelectRequest(client);
                                }
                              }}
                              className="w-4 h-4 rounded border-white/20 bg-white/5 text-sky-300 focus:ring-2 focus:ring-sky-300/50 cursor-pointer"
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3">
                                <h4 className="font-semibold text-white">
                                  {client.first_name} {client.last_name}
                                </h4>
                                {isSelected && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-300/20 text-sky-300 border border-sky-300/30">
                                    Selected
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-xs text-[#bdbdbd]">
                                <span>
                                  {client.phone_normalized ||
                                    client.phone ||
                                    "No phone"}
                                </span>
                                {client.last_appt && (
                                  <>
                                    <span>•</span>
                                    <span>
                                      Last visit:{" "}
                                      {new Date(
                                        client.last_appt,
                                      ).toLocaleDateString()}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-[#bdbdbd]">
                                {client.total_appointments} visits
                              </p>
                            </div>
                          </div>
                        );
                      })}

                    {/* Deselected tab */}
                    {activeTab === "deselected" &&
                      filteredClients.map((client: any) => {
                        return (
                          <div
                            key={client.client_id}
                            className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={false}
                              onChange={() => {
                                handleReselectRequest(
                                  client.phone_normalized,
                                  `${client.first_name || ""} ${client.last_name || ""}`.trim() ||
                                    "Unknown Client",
                                );
                              }}
                              className="w-4 h-4 rounded border-white/20 bg-white/5 text-sky-300 focus:ring-2 focus:ring-sky-300/50 cursor-pointer"
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3">
                                <h4 className="font-semibold text-white">
                                  {client.first_name} {client.last_name}
                                </h4>
                                <span
                                  className={`text-xs px-2 py-1 rounded-full ${
                                    client.visiting_type === "consistent"
                                      ? "bg-green-500/20 text-green-400"
                                      : client.visiting_type ===
                                          "semi-consistent"
                                        ? "bg-blue-500/20 text-blue-400"
                                        : client.visiting_type === "easy-going"
                                          ? "bg-yellow-500/20 text-yellow-400"
                                          : client.visiting_type === "rare"
                                            ? "bg-red-500/20 text-red-400"
                                            : "bg-gray-500/20 text-gray-400"
                                  }`}
                                >
                                  {client.visiting_type}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-xs text-[#bdbdbd]">
                                <span>{client.phone_normalized}</span>
                                <span>•</span>
                                <span>
                                  {client.days_since_last_visit} days since last
                                  visit
                                </span>
                                <span>•</span>
                                <span className="text-orange-400">
                                  {client.days_overdue} days overdue
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-sky-300">
                                Score: {client.score}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Select Confirmation Modal */}
          <AnimatePresence>
            {showSelectModal && pendingSelectClient && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                onClick={() => setShowSelectModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-sky-300/20 text-sky-300 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-2">
                        Select Client?
                      </h3>
                      <p className="text-sm text-[#bdbdbd]">
                        <span className="text-white font-semibold">
                          {pendingSelectClient.first_name}{" "}
                          {pendingSelectClient.last_name}
                        </span>{" "}
                        will always receive this message regardless of the
                        algorithm.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-lg mb-4">
                    <div className="flex items-start gap-2 text-sm text-sky-300">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p>
                        This client will not appear on the Client List page
                        but they will receive your message.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowSelectModal(false);
                        setPendingSelectClient(null);
                      }}
                      className="flex-1 px-4 py-3 rounded-xl font-bold bg-white/5 text-[#bdbdbd] hover:bg-white/10 hover:text-white transition-all duration-300 border border-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmSelect}
                      className="flex-1 px-4 py-3 rounded-xl font-bold bg-sky-300/20 text-sky-300 border border-sky-300/30 hover:bg-sky-300/30 transition-all duration-300"
                    >
                      Select Client
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Unselect Confirmation Modal */}
          <AnimatePresence>
            {showUnselectModal && pendingUnselectClient && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                onClick={() => setShowUnselectModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-amber-300/20 text-amber-300 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-2">
                        Remove Selection?
                      </h3>
                      <p className="text-sm text-[#bdbdbd]">
                        <span className="text-white font-semibold">
                          {pendingUnselectClient.first_name}{" "}
                          {pendingUnselectClient.last_name}
                        </span>{" "}
                        will return to being selected by the algorithm only.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4">
                    <div className="flex items-start gap-2 text-sm text-amber-300">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p>
                        This client may or may not receive future messages
                        depending on the algorithm.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowUnselectModal(false);
                        setPendingUnselectClient(null);
                      }}
                      className="flex-1 px-4 py-3 rounded-xl font-bold bg-white/5 text-[#bdbdbd] hover:bg-white/10 hover:text-white transition-all duration-300 border border-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmUnselect}
                      className="flex-1 px-4 py-3 rounded-xl font-bold bg-amber-300/20 text-amber-300 border border-amber-300/30 hover:bg-amber-300/30 transition-all duration-300"
                    >
                      Remove Selection
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Deselect Confirmation Modal */}
          <AnimatePresence>
            {showDeselectModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                onClick={() => setShowDeselectModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-amber-300/20 text-amber-300 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-2">
                        Deselect Client?
                      </h3>
                      <p className="text-sm text-[#bdbdbd]">
                        <span className="text-white font-semibold">
                          {pendingDeselectName}
                        </span>{" "}
                        will not receive this message and will be moved to the
                        Deselected Clients list.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4">
                    <div className="flex items-start gap-2 text-sm text-amber-300">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p>
                        This client will be excluded from all future sends of
                        this campaign.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowDeselectModal(false);
                        setPendingDeselectPhone(null);
                        setPendingDeselectName("");
                      }}
                      className="flex-1 px-4 py-3 rounded-xl font-bold bg-white/5 text-[#bdbdbd] hover:bg-white/10 hover:text-white transition-all duration-300 border border-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDeselect}
                      className="flex-1 px-4 py-3 rounded-xl font-bold bg-amber-300/20 text-amber-300 border border-amber-300/30 hover:bg-amber-300/30 transition-all duration-300"
                    >
                      Deselect Client
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reselect Confirmation Modal */}
          <AnimatePresence>
            {showReselectModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                onClick={() => setShowReselectModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-lime-300/20 text-lime-300 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-2">
                        Remove from Deselected?
                      </h3>
                      <p className="text-sm text-[#bdbdbd]">
                        <span className="text-white font-semibold">
                          {pendingReselectName}
                        </span>{" "}
                        will be added back to the algorithm and may receive
                        future campaign messages.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-lime-500/10 border border-lime-500/20 rounded-lg mb-4">
                    <div className="flex items-start gap-2 text-sm text-lime-300">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p>
                        This client will be eligible to receive messages from
                        this campaign again based on the algorithm.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowReselectModal(false);
                        setPendingReselectPhone(null);
                        setPendingReselectName("");
                      }}
                      className="flex-1 px-4 py-3 rounded-xl font-bold bg-white/5 text-[#bdbdbd] hover:bg-white/10 hover:text-white transition-all duration-300 border border-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmReselect}
                      className="flex-1 px-4 py-3 rounded-xl font-bold bg-lime-300/20 text-lime-300 border border-lime-300/30 hover:bg-lime-300/30 transition-all duration-300"
                    >
                      Remove from Deselected
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
