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
  onRefresh?: () => void;
  messageTitle: string;
  messageId: string | null;
  previewClients: PreviewClient[];
  deselectedPreviewClients: PreviewClient[];
  previewStats: PreviewStats | null;
  maxClients: number;
  initialTotalUnselectedClients: number;
}

type TabType = "client-list" | "deselected" | "selected";

export default function RecipientPreviewModal({
  isOpen,
  onClose,
  onRefresh,
  messageTitle,
  messageId,
  previewClients,
  deselectedPreviewClients,
  previewStats,
  maxClients,
  initialTotalUnselectedClients,
}: RecipientPreviewModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("client-list");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [deselectedClients, setDeselectedClients] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<any[]>([]);

  const [batchSelectedForAction, setBatchSelectedForAction] = useState<Set<string>>(new Set());
  const [showBatchConfirmModal, setShowBatchConfirmModal] = useState(false);
  const [batchActionType, setBatchActionType] = useState<'select' | 'deselect' | null>(null);

  // All clients pagination
  const [allClients, setAllClients] = useState<PreviewClient[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingAllClients, setLoadingAllClients] = useState(false);

  const [showDeselectModal, setShowDeselectModal] = useState(false);
  const [showReselectModal, setShowReselectModal] = useState(false);
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [showUnselectModal, setShowUnselectModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const [totalUnselectedClients, setTotalUnselectedClients] = useState(initialTotalUnselectedClients);

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

  // const [totalUnselectedClients, setTotalUnselectedClients] = useState(0);

  const [otherClientsPage, setOtherClientsPage] = useState(1);

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
    if (activeTab === "deselected") {
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

  useEffect(() => {
    if (!isOpen) {
      setBatchSelectedForAction(new Set());
    }
  }, [isOpen]);

  useEffect(() => {
    setBatchSelectedForAction(new Set());
  }, [activeTab]);

  useEffect(() => {
    loadAllClients();
  }, [otherClientsPage]);

  useEffect(() => {
    setTotalUnselectedClients(initialTotalUnselectedClients);
  }, [initialTotalUnselectedClients]);

  const toggleBatchSelection = (phone: string) => {
    const newSet = new Set(batchSelectedForAction);
    if (newSet.has(phone)) {
      newSet.delete(phone);
    } else {
      newSet.add(phone);
    }
    setBatchSelectedForAction(newSet);
  };

  // Handle batch confirm button
  const handleBatchConfirm = async (actionType: 'select' | 'deselect') => {
    if (batchSelectedForAction.size === 0) {
      toast.error('Please select at least one client');
      return;
    }
    
    if (!(await checkMessageExistsInDatabase())) return;
    
    setBatchActionType(actionType);
    setShowBatchConfirmModal(true);
  };

  // Confirm batch action
  const confirmBatchAction = async () => {
    if (!messageId || batchSelectedForAction.size === 0 || !batchActionType) return;

    try {
      const { data: { user },} = await supabase.auth.getUser();
      if (!user) return;

      const phonesToProcess = Array.from(batchSelectedForAction);

      if (batchActionType === 'deselect') {
        // Add to deselected list
        const updatedDeselected = [...new Set([...deselectedClients, ...phonesToProcess])];
        
        // Remove from selected list
        const updatedSelected = selectedClients.filter(
          (c) => !phonesToProcess.includes(c.phone_normalized)
        );

        const { error } = await supabase
          .from("sms_scheduled_messages")
          .update({ 
            deselected_clients: updatedDeselected,
            selected_clients: updatedSelected
          })
          .eq("id", messageId)
          .eq("user_id", user.id);

        if (error) throw error;

        setDeselectedClients(updatedDeselected);
        setSelectedClients(updatedSelected);
        toast.success(`${phonesToProcess.length} client${phonesToProcess.length > 1 ? 's' : ''} deselected`);
      } else {
        // When selecting from Other Clients tab
        const phonesToProcess = Array.from(batchSelectedForAction);
        
        // Remove from deselected list
        const updatedDeselected = deselectedClients.filter(
          phone => !phonesToProcess.includes(phone)
        );

        // Only add to selected_clients if they were NOT manually deselected
        // (if they're in deselectedClients, they were originally in the algorithm)
        const clientsToAdd = allClients
          .filter(c => {
            const phone = c.phone_normalized || '';
            const wasManuallyDeselected = deselectedClients.includes(phone);
            
            console.log(`Phone ${phone}: wasManuallyDeselected=${wasManuallyDeselected}`);
            
            // If they were manually deselected, don't add to selected_clients
            // If they were never in algorithm, add to selected_clients
            return phonesToProcess.includes(phone) && !wasManuallyDeselected;
          })
          .map(c => ({
            client_id: c.client_id,
            first_name: c.first_name,
            last_name: c.last_name,
            phone_normalized: c.phone_normalized,
          }));

        console.log("Clients to add:", clientsToAdd);

        const updatedSelected = [...selectedClients, ...clientsToAdd];

        const { error } = await supabase
          .from("sms_scheduled_messages")
          .update({ 
            selected_clients: updatedSelected,
            deselected_clients: updatedDeselected
          })
          .eq("id", messageId)
          .eq("user_id", user.id);

        if (error) throw error;

        setSelectedClients(updatedSelected);
        setDeselectedClients(updatedDeselected);
        toast.success(`${phonesToProcess.length} client${phonesToProcess.length > 1 ? 's' : ''} selected`);
      }

      // Clear batch selection and close modal
      setBatchSelectedForAction(new Set());
      setShowBatchConfirmModal(false);
      setBatchActionType(null);
      
      // Close and refresh the modal
      onClose();
      setTimeout(() => {
        if (onRefresh) {
          onRefresh();
        }
      }, 100);

    } catch (error) {
      console.error('Failed to process batch action:', error);
      toast.error('Failed to update clients');
      setShowBatchConfirmModal(false);
      setBatchActionType(null);
    }
  };

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

  // Load all OTHER clients for Deselected Clients tab (NOT in algorithm)
  const loadAllClients = async () => {
    setLoadingAllClients(true);

    try {
      // Use deselected clients returned by the algorithm
      const clients = deselectedPreviewClients || [];

      // Put manually deselected ones at the top
      const manuallyDeselected = clients.filter((c: any) =>
        deselectedClients.includes(c.phone_normalized || '')
      );

      const notDeselected = clients.filter((c: any) =>
        !deselectedClients.includes(c.phone_normalized || '')
      );

      const sortedClients = [...manuallyDeselected, ...notDeselected];

      // Calculate pagination
      const totalPages = Math.ceil(sortedClients.length / CLIENT_LIST_PER_PAGE);
      const startIndex = (otherClientsPage - 1) * CLIENT_LIST_PER_PAGE;
      const endIndex = startIndex + CLIENT_LIST_PER_PAGE;
      const paginatedClients = sortedClients.slice(startIndex, endIndex);

      setAllClients(paginatedClients);
      setTotalUnselectedClients(sortedClients.length);
      setTotalPages(totalPages);
      setCurrentPage(otherClientsPage); // Make sure you have this state
    } catch (error) {
      console.error('Failed to load all clients:', error);
      toast.error('Failed to load clients');
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

  const handleRemoveFromDeselected = async (client: any) => {
    if (!(await checkMessageExistsInDatabase())) return;
    
    setPendingReselectPhone(client.phone_normalized || "");
    setPendingReselectName(`${client.first_name || ""} ${client.last_name || ""}`.trim() || "Unknown Client");
    setShowReselectModal(true);
  };

  // For Deselected tab - adding a new client to deselected
  const handleAddToDeselected = async (client: AllClient) => {
    if (!(await checkMessageExistsInDatabase())) return;
    
    setPendingDeselectPhone(client.phone_normalized || "");
    setPendingDeselectName(`${client.first_name || ""} ${client.last_name || ""}`.trim() || "Unknown Client");
    setShowDeselectModal(true);
  };

  const handleMoveToDeselected = async (phone: string, name: string) => {
    if (!(await checkMessageExistsInDatabase())) return;
    
    setPendingDeselectPhone(phone);
    setPendingDeselectName(name);
    setShowDeselectModal(true);
  };

  const confirmDeselect = async () => {
    if (!pendingDeselectPhone || !messageId) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Add to deselected list
      const updatedDeselected = [...deselectedClients, pendingDeselectPhone];

      // ALSO remove from selected list if they're there
      const updatedSelected = selectedClients.filter(
        (c) => c.phone_normalized !== pendingDeselectPhone
      );

      const { error } = await supabase
        .from("sms_scheduled_messages")
        .update({ 
          deselected_clients: updatedDeselected,
          selected_clients: updatedSelected // Update both at once
        })
        .eq("id", messageId)
        .eq("user_id", user.id);

      if (error) throw error;

      setDeselectedClients(updatedDeselected);
      setSelectedClients(updatedSelected); // Update local state too
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

    console.log("Removing phone:", pendingReselectPhone);
    console.log("Current deselected:", deselectedClients);
    console.log("Current selected:", selectedClients);

    // Remove from deselected list
    const updatedDeselected = deselectedClients.filter(
      (phone) => phone !== pendingReselectPhone,
    );

    // ALSO remove from selected list if they're there
    const updatedSelected = selectedClients.filter(
      (c) => c.phone_normalized !== pendingReselectPhone
    );

    console.log("Updated deselected:", updatedDeselected);
    console.log("Updated selected:", updatedSelected);

    const { error } = await supabase
      .from("sms_scheduled_messages")
      .update({ 
        deselected_clients: updatedDeselected,
        selected_clients: updatedSelected
      })
      .eq("id", messageId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Database error:", error);
      throw error;
    }

    console.log("Database updated successfully");

    setDeselectedClients(updatedDeselected);
    setSelectedClients(updatedSelected);
    
    toast.success("Client removed from deselected list");
    
    onClose();
    setTimeout(() => {
      if (onRefresh) {
        onRefresh();
      }
    }, 100);
    
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

  const getFilteredClients = () => {
    // For client list tab
    if (activeTab === "client-list") {
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

      // Return paginated results
      const start = (clientListPage - 1) * CLIENT_LIST_PER_PAGE;
      return filteredPreview.slice(start, start + CLIENT_LIST_PER_PAGE);
    }

    // For deselected tab - apply search filter
    if (activeTab === "deselected") {
      if (debouncedSearch) {
        const search = debouncedSearch.toLowerCase();
        return allClients.filter((client) => {
          const fullName =
            `${client.first_name || ""} ${client.last_name || ""}`.toLowerCase();
          const phone = (client.phone_normalized || "").toLowerCase();
          return fullName.includes(search) || phone.includes(search);
        });
      }
      return allClients;
    }

    return [];
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

  const handleResetSelections = async () => {
    if (!messageId) {
      toast.error("Please save this message as a draft first");
      return;
    }
    
    setShowResetModal(true);
  };

  const confirmReset = async () => {
    if (!messageId) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("sms_scheduled_messages")
        .update({ 
          deselected_clients: [],
          selected_clients: []
        })
        .eq("id", messageId)
        .eq("user_id", user.id);

      if (error) throw error;

      setDeselectedClients([]);
      setSelectedClients([]);
      setBatchSelectedForAction(new Set());
      
      toast.success("All selections reset");
      
      setShowResetModal(false);
      
      // Refresh the modal
      if (onRefresh) {
        onClose();
        setTimeout(() => {
          onRefresh();
        }, 100);
      }
    } catch (error) {
      console.error('Failed to reset selections:', error);
      toast.error('Failed to reset selections');
      setShowResetModal(false);
    }
  };

  const filteredClients = getFilteredClients();
  const activeClientCount = previewClients.length;

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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 min-h-screen flex"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="
              bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl
              w-full
              max-w-4xl
              h-[85dvh] md:h-auto
              md:min-h-[90vh] md:max-h-[90vh]
              overflow-hidden flex flex-col
              mb-20 sm:mb-0
            "
          >

            {/* Modal Header */}
            <div className="p-4 md:p-6 border-b border-white/10 flex-shrink-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 md:w-5 md:h-5 text-sky-300 flex-shrink-0" />
                    <span className="truncate">Recipients for {messageTitle}</span>
                  </h3>
                  {previewStats && (
                    <p className="text-xs md:text-sm text-[#bdbdbd] mt-1">
                      <span className="block sm:inline">{activeClientCount} active • {selectedClients.length} selected</span>
                      <span className="block sm:inline sm:before:content-['_•_']">{totalUnselectedClients} deselected • Max: {maxClients}</span>
                    </p>
                  )}
                </div>

                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
                >
                  <X className="w-5 h-5 text-[#bdbdbd]" />
                </button>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="grid grid-cols-2 border-b border-white/10 flex-shrink-0">
              <button
                onClick={() => setActiveTab("client-list")}
                className={`px-3 md:px-4 py-3 text-xs md:text-sm font-semibold transition-all relative flex justify-center items-center ${
                  activeTab === "client-list"
                    ? "text-sky-300"
                    : "text-[#bdbdbd] hover:text-white"
                }`}
              >
                <span className="hidden sm:inline">Client List</span>
                <span className="sm:hidden">Clients</span>
                <span className="ml-1.5 md:ml-2 px-1.5 md:px-2 py-0.5 rounded-full text-[10px] md:text-xs bg-white/10">
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
                onClick={() => setActiveTab("deselected")}
                className={`px-3 md:px-4 py-3 text-xs md:text-sm font-semibold transition-all relative flex justify-center items-center ${
                  activeTab === "deselected"
                    ? "text-sky-300"
                    : "text-[#bdbdbd] hover:text-white"
                }`}
              >
                <span className="hidden sm:inline">Other Clients</span>
                <span className="sm:hidden">Other</span>
                <span className="ml-1.5 md:ml-2 px-1.5 md:px-2 py-0.5 rounded-full text-[10px] md:text-xs bg-white/10">
                  {totalUnselectedClients > 0 ? totalUnselectedClients : '...'}
                </span>
                {activeTab === "deselected" && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-300"
                  />
                )}
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-3 md:p-4 border-b border-white/10 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#bdbdbd]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or phone..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm md:text-base text-white placeholder-[#bdbdbd]/50 focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all"
                />
              </div>
            </div>

            {/* Clients List */}
            <div className="overflow-y-auto flex-1 relative">
              {/* Stats - Only show on Client List tab - INSIDE SCROLLABLE CONTAINER */}
              {previewStats && activeTab === "client-list" && (
                <div className="px-3 md:px-6 py-3 md:py-4 border-b border-white/10 bg-white/5">
                  <div className="flex items-center justify-between gap-3 md:gap-6">
                    <div className="grid grid-cols-2 md:flex md:gap-6 gap-3 md:gap-y-0 w-full">
                      <div>
                        <p className="text-[10px] md:text-xs text-[#bdbdbd] mb-0.5">
                          Total Selected
                        </p>
                        <p className="text-base md:text-xl font-bold text-white">
                          {activeClientCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] md:text-xs text-[#bdbdbd] mb-0.5">Avg Score</p>
                        <p className="text-base md:text-xl font-bold text-sky-300">
                          {previewStats.avg_score}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] md:text-xs text-[#bdbdbd] mb-0.5">
                          Avg Days Since
                        </p>
                        <p className="text-base md:text-xl font-bold text-purple-400">
                          {previewStats.avg_days_since_last_visit}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] md:text-xs text-[#bdbdbd] mb-0.5">
                          Avg Overdue
                        </p>
                        <p className="text-base md:text-xl font-bold text-orange-400">
                          {previewStats.avg_days_overdue}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Metric Explanations */}
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5 text-[10px] md:text-xs text-[#bdbdbd]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                      <div>
                        <span className="text-sky-300 font-medium">Score:</span>{" "}
                        Higher = more urgent
                      </div>
                      <div>
                        <span className="text-purple-400 font-medium">
                          Days Since:
                        </span>{" "}
                        Since last appointment
                      </div>
                      <div>
                        <span className="text-orange-400 font-medium">
                          Overdue:
                        </span>{" "}
                        Late based on pattern
                      </div>
                    </div>

                    {/* Client Types Legend */}
                    <div className="flex flex-wrap gap-2 md:gap-3 pt-2">
                      {previewStats.breakdown.consistent > 0 && (
                        <span className="bg-green-500/10 text-green-400 px-1.5 md:px-2 py-0.5 rounded text-[9px] md:text-[11px] flex items-center gap-1 md:gap-1.5">
                          <span className="font-medium">Consistent:</span>
                          <span className="hidden sm:inline">Weekly</span>
                          <span className="px-1 md:px-1.5 py-0.5 rounded-full text-[9px] md:text-[10px] font-semibold bg-green-500/20">
                            {previewStats.breakdown.consistent}
                          </span>
                        </span>
                      )}
                      {previewStats.breakdown["semi-consistent"] > 0 && (
                        <span className="bg-blue-500/10 text-blue-400 px-1.5 md:px-2 py-0.5 rounded text-[9px] md:text-[11px] flex items-center gap-1 md:gap-1.5">
                          <span className="font-medium">Semi:</span>
                          <span className="hidden sm:inline">2-3 weeks</span>
                          <span className="px-1 md:px-1.5 py-0.5 rounded-full text-[9px] md:text-[10px] font-semibold bg-blue-500/20">
                            {previewStats.breakdown["semi-consistent"]}
                          </span>
                        </span>
                      )}
                      {previewStats.breakdown["easy-going"] > 0 && (
                        <span className="bg-yellow-500/10 text-yellow-400 px-1.5 md:px-2 py-0.5 rounded text-[9px] md:text-[11px] flex items-center gap-1 md:gap-1.5">
                          <span className="font-medium">Easy:</span>
                          <span className="hidden sm:inline">1-2 mo</span>
                          <span className="px-1 md:px-1.5 py-0.5 rounded-full text-[9px] md:text-[10px] font-semibold bg-yellow-500/20">
                            {previewStats.breakdown["easy-going"]}
                          </span>
                        </span>
                      )}
                      {previewStats.breakdown.rare > 0 && (
                        <span className="bg-red-500/10 text-red-400 px-1.5 md:px-2 py-0.5 rounded text-[9px] md:text-[11px] flex items-center gap-1 md:gap-1.5">
                          <span className="font-medium">Rare:</span>
                          <span className="hidden sm:inline">2+ mo</span>
                          <span className="px-1 md:px-1.5 py-0.5 rounded-full text-[9px] md:text-[10px] font-semibold bg-red-500/20">
                            {previewStats.breakdown.rare}
                          </span>
                        </span>
                      )}
                      {previewStats.breakdown.new > 0 && (
                        <span className="bg-gray-500/10 text-gray-400 px-1.5 md:px-2 py-0.5 rounded text-[9px] md:text-[11px] flex items-center gap-1 md:gap-1.5">
                          <span className="font-medium">New</span>
                          <span className="px-1 md:px-1.5 py-0.5 rounded-full text-[9px] md:text-[10px] font-semibold bg-gray-500/20">
                            {previewStats.breakdown.new}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sticky Pagination - Client List */}
              {activeTab === "client-list" && (
                <div className="sticky top-0 z-10 bg-[#1a1a1a] border-b border-white/10 px-3 md:px-6 py-2 md:py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 md:gap-4 min-w-0">
                      <p className="text-xs md:text-sm text-[#bdbdbd] truncate">
                        <span className="hidden sm:inline">Page {clientListPage} of {clientListTotalPages} • </span>
                        {filteredClients.length} client{filteredClients.length !== 1 ? "s" : ""}
                      </p>
                    </div>

                    <div className="flex gap-1.5 md:gap-2 flex-shrink-0">
                      <button
                        onClick={handleResetSelections}
                        className="px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs md:text-sm font-semibold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all duration-300"
                      >
                        <span className="hidden sm:inline">Reset All</span>
                        <span className="sm:hidden">Reset</span>
                      </button>
                      
                      {batchSelectedForAction.size > 0 && (
                        <>
                          <div className="w-px h-6 md:h-8 bg-white/10" />
                          <button
                            onClick={() => setBatchSelectedForAction(new Set())}
                            className="px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs md:text-sm font-semibold bg-white/5 text-[#bdbdbd] hover:bg-white/10 hover:text-white transition-all duration-300 border border-white/10"
                          >
                            Clear
                          </button>
                          <button
                            onClick={() => handleBatchConfirm('deselect')}
                            className="px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs md:text-sm font-semibold bg-amber-300/20 text-amber-300 border border-amber-300/30 hover:bg-amber-300/30 transition-all duration-300 whitespace-nowrap"
                          >
                            <span className="hidden sm:inline">Deselect {batchSelectedForAction.size}</span>
                            <span className="sm:hidden">-{batchSelectedForAction.size}</span>
                          </button>
                        </>
                      )}
                      
                      {clientListTotalPages > 1 && (
                        <>
                          <div className="w-px h-6 md:h-8 bg-white/10" />
                          <button
                            onClick={() => setClientListPage((p) => Math.max(1, p - 1))}
                            disabled={clientListPage === 1}
                            className="p-1.5 md:p-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronLeft className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                          <button
                            onClick={() => setClientListPage((p) => Math.min(clientListTotalPages, p + 1))}
                            disabled={clientListPage === clientListTotalPages}
                            className="p-1.5 md:p-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sticky Pagination - Deselected Clients */}
              {activeTab === "deselected" && (
                <div className="sticky top-0 z-10 bg-[#1a1a1a] border-b border-white/10 px-3 md:px-6 py-2 md:py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 md:gap-4 min-w-0">
                      <p className="text-xs md:text-sm text-[#bdbdbd] truncate">
                        <span className="hidden sm:inline">Page {currentPage} of {totalPages} • </span>
                        {allClients.length} client{allClients.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    
                    <div className="flex gap-1.5 md:gap-2 flex-shrink-0">
                      <button
                        onClick={handleResetSelections}
                        className="px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs md:text-sm font-semibold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all duration-300"
                      >
                        <span className="hidden sm:inline">Reset All</span>
                        <span className="sm:hidden">Reset</span>
                      </button>
                      
                      {batchSelectedForAction.size > 0 && (
                        <>
                          <div className="w-px h-6 md:h-8 bg-white/10" />
                          <button
                            onClick={() => setBatchSelectedForAction(new Set())}
                            className="px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs md:text-sm font-semibold bg-white/5 text-[#bdbdbd] hover:bg-white/10 hover:text-white transition-all duration-300 border border-white/10"
                          >
                            Clear
                          </button>
                          <button
                            onClick={() => handleBatchConfirm('select')}
                            className="px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs md:text-sm font-semibold bg-sky-300/20 text-sky-300 border border-sky-300/30 hover:bg-sky-300/30 transition-all duration-300 whitespace-nowrap"
                          >
                            <span className="hidden sm:inline">Select {batchSelectedForAction.size}</span>
                            <span className="sm:hidden">+{batchSelectedForAction.size}</span>
                          </button>
                        </>
                      )}
                      
                      {totalPages > 1 && (
                        <>
                          <div className="w-px h-6 md:h-8 bg-white/10" />
                          <button
                            onClick={() => setOtherClientsPage((p) => Math.max(1, p - 1))}
                            disabled={otherClientsPage === 1}
                            className="p-1.5 md:p-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronLeft className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                          <button
                            onClick={() => setOtherClientsPage((p) => Math.min(totalPages, p + 1))}
                            disabled={otherClientsPage === totalPages}
                            className="p-1.5 md:p-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="p-3 md:p-6">
                {loadingAllClients && activeTab === "deselected" ? (
                  <div className="text-center py-12">
                    <div className="w-8 h-8 border-2 border-sky-300 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-[#bdbdbd]">Loading clients...</p>
                  </div>
                ) : filteredClients.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-[#bdbdbd] mx-auto mb-4 opacity-50" />
                    <p className="text-sm md:text-base text-[#bdbdbd]">
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
                        const isDeselected = deselectedClients.includes(client.phone_normalized);
                        const isBatchSelected = batchSelectedForAction.has(client.phone_normalized);

                        const normalVisitInterval = client.avg_weekly_visits
                          ? Math.round(7 / client.avg_weekly_visits)
                          : null;

                        return (
                          <div
                            key={client.client_id}
                            className={`flex items-center gap-2 md:gap-4 p-3 md:p-4 border rounded-xl hover:bg-white/10 transition-colors ${
                              isBatchSelected
                                ? "bg-purple-300/10 border-purple-300/30"
                                : isDeselected
                                ? "bg-amber-300/10 border-amber-300/30"
                                : "bg-white/5 border-white/10"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isBatchSelected}
                              onChange={() => toggleBatchSelection(client.phone_normalized)}
                              className="w-4 h-4 rounded border-white/20 bg-white/5 text-purple-300 focus:ring-2 focus:ring-purple-300/50 cursor-pointer flex-shrink-0"
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold text-sm md:text-base text-white truncate">
                                  {client.first_name} {client.last_name}
                                </h4>
                                {isDeselected && (
                                  <span className="px-1.5 md:px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-semibold bg-amber-300/20 text-amber-300 border border-amber-300/30 flex-shrink-0">
                                    Deselected
                                  </span>
                                )}
                                <span
                                  className={`text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded-full flex-shrink-0 ${
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
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1.5 md:mt-2 text-[10px] md:text-xs text-[#bdbdbd]">
                                <span className="truncate">{client.phone_normalized}</span>
                                <span className="hidden sm:inline">•</span>
                                <span className="truncate">
                                  {client.days_since_last_visit} days since visit
                                </span>
                                <span className="hidden sm:inline">•</span>
                                <span className="text-orange-400 truncate">
                                  {client.days_overdue} days overdue
                                </span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs md:text-sm font-semibold text-sky-300">
                                Score: {client.score}
                              </p>
                              {normalVisitInterval && (
                                <p className="text-[10px] md:text-xs text-[#bdbdbd] hidden sm:block">
                                  Every ~{normalVisitInterval} days
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}

                    {/* Deselected tab - all clients from API */}
                    {activeTab === "deselected" &&
                      filteredClients.map((client) => {
                        const isSelected = selectedClients.some(
                          (c) => c.phone_normalized === client.phone_normalized
                        );
                        const isBatchSelected = batchSelectedForAction.has(client.phone_normalized || '');

                        return (
                          <div
                            key={client.client_id}
                            className={`flex items-center gap-2 md:gap-4 p-3 md:p-4 border rounded-xl hover:bg-white/10 transition-colors ${
                              isBatchSelected
                                ? "bg-purple-300/10 border-purple-300/30"
                                : isSelected
                                ? "bg-sky-300/10 border-sky-300/30"
                                : "bg-white/5 border-white/10"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isBatchSelected}
                              onChange={() => toggleBatchSelection(client.phone_normalized || '')}
                              className="w-4 h-4 rounded border-white/20 bg-white/5 text-purple-300 focus:ring-2 focus:ring-purple-300/50 cursor-pointer flex-shrink-0"
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold text-sm md:text-base text-white truncate">
                                  {client.first_name} {client.last_name}
                                </h4>
                                {isSelected && (
                                  <span className="px-1.5 md:px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-semibold bg-sky-300/20 text-sky-300 border border-sky-300/30 flex-shrink-0">
                                    Selected
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1.5 md:mt-2 text-[10px] md:text-xs text-[#bdbdbd]">
                                <span className="truncate">
                                  {(client.phone_normalized || 
                                    ('phone' in client ? client.phone : '') || 
                                    "No phone") as React.ReactNode}
                                </span>
                                {client.last_appt && (
                                  <>
                                    <span className="hidden sm:inline">•</span>
                                    <span className="truncate">
                                      Last visit:{" "}
                                      {new Date(
                                        client.last_appt,
                                      ).toLocaleDateString()}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-[10px] md:text-xs text-[#bdbdbd]">
                                {client.total_appointments} visits
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
                  className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-4 md:p-6"
                >
                  <div className="flex items-start gap-3 md:gap-4 mb-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-sky-300/20 text-sky-300 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg md:text-xl font-bold text-white mb-2">
                        Select Client?
                      </h3>
                      <p className="text-xs md:text-sm text-[#bdbdbd]">
                        <span className="text-white font-semibold">
                          {pendingSelectClient.first_name}{" "}
                          {pendingSelectClient.last_name}
                        </span>{" "}
                        will always receive this message regardless of the
                        algorithm.
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 md:p-3 bg-sky-500/10 border border-sky-500/20 rounded-lg mb-4">
                    <div className="flex items-start gap-2 text-xs md:text-sm text-sky-300">
                      <AlertCircle className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0 mt-0.5" />
                      <p>
                        This client will not appear on the Client List page
                        but they will receive your message.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 md:gap-3">
                    <button
                      onClick={() => {
                        setShowSelectModal(false);
                        setPendingSelectClient(null);
                      }}
                      className="flex-1 px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-sm md:text-base font-bold bg-white/5 text-[#bdbdbd] hover:bg-white/10 hover:text-white transition-all duration-300 border border-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmSelect}
                      className="flex-1 px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-sm md:text-base font-bold bg-sky-300/20 text-sky-300 border border-sky-300/30 hover:bg-sky-300/30 transition-all duration-300"
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
                  className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-4 md:p-6"
                >
                  <div className="flex items-start gap-3 md:gap-4 mb-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-amber-300/20 text-amber-300 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg md:text-xl font-bold text-white mb-2">
                        Remove Selection?
                      </h3>
                      <p className="text-xs md:text-sm text-[#bdbdbd]">
                        <span className="text-white font-semibold">
                          {pendingUnselectClient.first_name}{" "}
                          {pendingUnselectClient.last_name}
                        </span>{" "}
                        will return to being selected by the algorithm only.
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 md:p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4">
                    <div className="flex items-start gap-2 text-xs md:text-sm text-amber-300">
                      <AlertCircle className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0 mt-0.5" />
                      <p>
                        This client may or may not receive future messages
                        depending on the algorithm.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 md:gap-3">
                    <button
                      onClick={() => {
                        setShowUnselectModal(false);
                        setPendingUnselectClient(null);
                      }}
                      className="flex-1 px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-sm md:text-base font-bold bg-white/5 text-[#bdbdbd] hover:bg-white/10 hover:text-white transition-all duration-300 border border-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmUnselect}
                      className="flex-1 px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-sm md:text-base font-bold bg-amber-300/20 text-amber-300 border border-amber-300/30 hover:bg-amber-300/30 transition-all duration-300"
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
                  className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-4 md:p-6"
                >
                  <div className="flex items-start gap-3 md:gap-4 mb-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-amber-300/20 text-amber-300 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg md:text-xl font-bold text-white mb-2">
                        Deselect Client?
                      </h3>
                      <p className="text-xs md:text-sm text-[#bdbdbd]">
                        <span className="text-white font-semibold">
                          {pendingDeselectName}
                        </span>{" "}
                        will not receive this message and will be moved to the
                        Deselected Clients list.
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 md:p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4">
                    <div className="flex items-start gap-2 text-xs md:text-sm text-amber-300">
                      <AlertCircle className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0 mt-0.5" />
                      <p>
                        This client will be excluded from all future sends of
                        this campaign.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 md:gap-3">
                    <button
                      onClick={() => {
                        setShowDeselectModal(false);
                        setPendingDeselectPhone(null);
                        setPendingDeselectName("");
                      }}
                      className="flex-1 px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-sm md:text-base font-bold bg-white/5 text-[#bdbdbd] hover:bg-white/10 hover:text-white transition-all duration-300 border border-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDeselect}
                      className="flex-1 px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-sm md:text-base font-bold bg-amber-300/20 text-amber-300 border border-amber-300/30 hover:bg-amber-300/30 transition-all duration-300"
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
                  className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-4 md:p-6"
                >
                  <div className="flex items-start gap-3 md:gap-4 mb-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-lime-300/20 text-lime-300 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg md:text-xl font-bold text-white mb-2">
                        Remove from Deselected?
                      </h3>
                      <p className="text-xs md:text-sm text-[#bdbdbd]">
                        <span className="text-white font-semibold">
                          {pendingReselectName}
                        </span>{" "}
                        will be added back to the algorithm and may receive
                        future campaign messages.
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 md:p-3 bg-lime-500/10 border border-lime-500/20 rounded-lg mb-4">
                    <div className="flex items-start gap-2 text-xs md:text-sm text-lime-300">
                      <AlertCircle className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0 mt-0.5" />
                      <p>
                        This client will be eligible to receive messages from
                        this campaign again based on the algorithm.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 md:gap-3">
                    <button
                      onClick={() => {
                        setShowReselectModal(false);
                        setPendingReselectPhone(null);
                        setPendingReselectName("");
                      }}
                      className="flex-1 px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-sm md:text-base font-bold bg-white/5 text-[#bdbdbd] hover:bg-white/10 hover:text-white transition-all duration-300 border border-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmReselect}
                      className="flex-1 px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-sm md:text-base font-bold bg-lime-300/20 text-lime-300 border border-lime-300/30 hover:bg-lime-300/30 transition-all duration-300"
                    >
                      Remove from Deselected
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showBatchConfirmModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                onClick={() => setShowBatchConfirmModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-4 md:p-6"
                >
                  <div className="flex items-start gap-3 md:gap-4 mb-4">
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                      batchActionType === 'select' ? 'bg-sky-300/20 text-sky-300' : 'bg-amber-300/20 text-amber-300'
                    }`}>
                      <AlertCircle className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg md:text-xl font-bold text-white mb-2">
                        {batchActionType === 'select' ? 'Select' : 'Deselect'} {batchSelectedForAction.size} Client{batchSelectedForAction.size > 1 ? 's' : ''}?
                      </h3>
                      <p className="text-xs md:text-sm text-[#bdbdbd]">
                        {batchActionType === 'select' 
                          ? `${batchSelectedForAction.size} client${batchSelectedForAction.size > 1 ? 's' : ''} will always receive this message regardless of the algorithm.`
                          : `${batchSelectedForAction.size} client${batchSelectedForAction.size > 1 ? 's' : ''} will not receive this message.`
                        }
                      </p>
                    </div>
                  </div>

                  <div className={`p-2.5 md:p-3 rounded-lg mb-4 ${
                    batchActionType === 'select' ? 'bg-sky-500/10 border border-sky-500/20' : 'bg-amber-500/10 border border-amber-500/20'
                  }`}>
                    <div className={`flex items-start gap-2 text-xs md:text-sm ${
                      batchActionType === 'select' ? 'text-sky-300' : 'text-amber-300'
                    }`}>
                      <AlertCircle className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0 mt-0.5" />
                      <p>
                        {batchActionType === 'select'
                          ? 'Your selected clients will replace the lowest-scored clients on the algorithm, keeping your max the same.'
                          : 'These clients will be excluded from all future sends of this campaign.'
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 md:gap-3">
                    <button
                      onClick={() => {
                        setShowBatchConfirmModal(false);
                        setBatchActionType(null);
                      }}
                      className="flex-1 px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-sm md:text-base font-bold bg-white/5 text-[#bdbdbd] hover:bg-white/10 hover:text-white transition-all duration-300 border border-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmBatchAction}
                      className={`flex-1 px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-sm md:text-base font-bold transition-all duration-300 ${
                        batchActionType === 'select'
                          ? 'bg-sky-300/20 text-sky-300 border border-sky-300/30 hover:bg-sky-300/30'
                          : 'bg-amber-300/20 text-amber-300 border border-amber-300/30 hover:bg-amber-300/30'
                      }`}
                    >
                      {batchActionType === 'select' ? 'Select Clients' : 'Deselect Clients'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reset Confirmation Modal */}
          <AnimatePresence>
            {showResetModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                onClick={() => setShowResetModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-4 md:p-6"
                >
                  <div className="flex items-start gap-3 md:gap-4 mb-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg md:text-xl font-bold text-white mb-2">
                        Reset All Selections?
                      </h3>
                      <p className="text-xs md:text-sm text-[#bdbdbd]">
                        This will reset all your deselected and manually selected clients. The algorithm will return to its default selection.
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 md:p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
                    <div className="flex items-start gap-2 text-xs md:text-sm text-red-400">
                      <AlertCircle className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0 mt-0.5" />
                      <p>
                        This action cannot be undone. All custom selections will be cleared.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 md:gap-3">
                    <button
                      onClick={() => setShowResetModal(false)}
                      className="flex-1 px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-sm md:text-base font-bold bg-white/5 text-[#bdbdbd] hover:bg-white/10 hover:text-white transition-all duration-300 border border-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmReset}
                      className="flex-1 px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-sm md:text-base font-bold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all duration-300"
                    >
                      Reset All
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