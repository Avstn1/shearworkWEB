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
  clientLimit: number; 
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
  clientLimit
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

  // One-time sms client
  const [showAddCustomModal, setShowAddCustomModal] = useState(false);
  const [customFirstName, setCustomFirstName] = useState('');
  const [customLastName, setCustomLastName] = useState('');
  const [customPhone, setCustomPhone] = useState('');

  const [showIncreaseLimitModal, setShowIncreaseLimitModal] = useState(false);

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

      // Check if this is a custom client
      const clientToDeselect = selectedClients.find(
        c => c.phone_normalized === pendingDeselectPhone
      );
      const isCustomClient = clientToDeselect?.is_custom;

      // If custom, delete from selected_clients entirely
      // If not custom, add to deselected_clients
      let updatedDeselected = deselectedClients;
      let updatedSelected = selectedClients;

      if (isCustomClient) {
        // Just remove from selected list
        updatedSelected = selectedClients.filter(
          c => c.phone_normalized !== pendingDeselectPhone
        );
      } else {
        // Add to deselected list and remove from selected
        updatedDeselected = [...deselectedClients, pendingDeselectPhone];
        updatedSelected = selectedClients.filter(
          c => c.phone_normalized !== pendingDeselectPhone
        );
      }

      const { error } = await supabase
        .from('sms_scheduled_messages')
        .update({ 
          deselected_clients: updatedDeselected,
          selected_clients: updatedSelected
        })
        .eq('id', messageId)
        .eq('user_id', user.id);

      if (error) throw error;

      setDeselectedClients(updatedDeselected);
      setSelectedClients(updatedSelected);
      toast.success(isCustomClient ? 'One-time recipient removed' : 'Client moved to deselected list');
    } catch (error) {
      console.error('Failed to deselect client:', error);
      toast.error('Failed to deselect client');
    } finally {
      setShowDeselectModal(false);
      setPendingDeselectPhone(null);
      setPendingDeselectName('');
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
    if (clientLimit === 0) {
      return [];
    }

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

  const validateCustomPhone = (phone: string): boolean => {
    // Remove all non-digits
    const digitsOnly = phone.replace(/\D/g, '');
    return digitsOnly.length === 10;
  };

  const handleAddCustomClient = async () => {
    // Validation
    if (!customFirstName.trim() || !customLastName.trim()) {
      toast.error('Please enter both first and last name');
      return;
    }

    if (!validateCustomPhone(customPhone)) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    const phoneNormalized = '+1' + customPhone.replace(/\D/g, '');

    // Check for duplicates in selected clients
    const isDuplicateSelected = selectedClients.some(
      c => c.phone_normalized === phoneNormalized
    );

    if (isDuplicateSelected) {
      toast.error('This phone number is already in your selected clients');
      return;
    }

    // Check for duplicates in preview clients (algorithm list)
    const isDuplicatePreview = previewClients.some(
      c => c.phone_normalized === phoneNormalized
    );

    if (isDuplicatePreview) {
      toast.error('This client is already in your client list');
      return;
    }

    if (!messageId) {
      toast.error('Please save this message as a draft first');
      return;
    }

    // MOVED: Check if there are already selected clients when limit is 0
    if (clientLimit === 0 && selectedClients.length > 0) {
      setShowAddCustomModal(false); // Close the add modal first
      setShowIncreaseLimitModal(true);
      return;
    }

    // Check if we need to increase the limit from 0 to 1
    if (clientLimit === 0 && selectedClients.length === 0) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('available_credits')
          .eq('user_id', user.id)
          .single();

        if (!profile || profile.available_credits < 1) {
          toast.error('You need at least 1 credit available to add a one-time recipient when max clients is 0');
          return;
        }

        // Update the message limit to 1
        const { error: updateError } = await supabase
          .from('sms_scheduled_messages')
          .update({ message_limit: 1 })
          .eq('id', messageId)
          .eq('user_id', user.id);

        if (updateError) {
          console.error('Failed to update message limit:', updateError);
          toast.error('Failed to update message limit');
          return;
        }

        toast.success('Message limit increased to 1 for one-time recipient');
      } catch (error) {
        console.error('Failed to check credits:', error);
        toast.error('Failed to verify credits');
        return;
      }
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const customClient = {
        client_id: `custom_${Date.now()}`,
        first_name: customFirstName.trim(),
        last_name: customLastName.trim(),
        phone_normalized: phoneNormalized,
        is_custom: true,
      };

      const updatedSelected = [...selectedClients, customClient];

      const { error } = await supabase
        .from('sms_scheduled_messages')
        .update({ selected_clients: updatedSelected })
        .eq('id', messageId)
        .eq('user_id', user.id);

      if (error) throw error;

      setSelectedClients(updatedSelected);
      toast.success('One-time recipient added successfully');

      // Reset form and close modal
      setCustomFirstName('');
      setCustomLastName('');
      setCustomPhone('');
      setShowAddCustomModal(false);

      // Refresh preview
      onClose();
      setTimeout(() => {
        if (onRefresh) {
          onRefresh();
        }
      }, 100);

    } catch (error) {
      console.error('Failed to add custom client:', error);
      toast.error('Failed to add recipient');
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
          className="modal-backdrop z-50 flex items-center justify-center p-4 min-h-screen"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="
              modal-surface
              w-full
              max-w-4xl
              h-[85dvh] md:h-auto
              md:min-h-[90vh] md:max-h-[90vh]
              overflow-hidden flex flex-col
              mb-20 sm:mb-0
            "
          >

            {/* Modal Header */}
            <div className="px-4 md:px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] font-semibold text-ivory flex items-center gap-2">
                    <Users className="w-[18px] h-[18px] text-gray-500 flex-shrink-0" strokeWidth={1.75} />
                    <span className="truncate">Recipients for {messageTitle}</span>
                  </h3>
                  {previewStats && (
                    <p className="text-[13px] text-muted mt-1 tabular-nums">
                      <span className="block sm:inline">
                        {clientLimit === 0 ? 0 : activeClientCount} active • {selectedClients.length} selected
                      </span>
                      <span className="block sm:inline sm:before:content-['_•_']">
                        {totalUnselectedClients} deselected • Max: {maxClients}
                      </span>
                    </p>
                  )}
                </div>

                <button
                  onClick={onClose}
                  className="btn btn-ghost btn-sm !h-8 !px-2 flex-shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="px-4 md:px-5 pt-3 flex-shrink-0">
              <div className="segmented grid grid-cols-2 w-full">
              <button
                onClick={() => setActiveTab("client-list")}
                data-active={activeTab === "client-list"}
                className="segmented-item flex justify-center items-center"
              >
                <span className="hidden sm:inline">Client List</span>
                <span className="sm:hidden">Clients</span>
                <span className="badge ml-2 tabular-nums">
                  {activeClientCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("deselected")}
                data-active={activeTab === "deselected"}
                className="segmented-item flex justify-center items-center"
              >
                <span className="hidden sm:inline">Other Clients</span>
                <span className="sm:hidden">Other</span>
                <span className="badge ml-2 tabular-nums">
                  {totalUnselectedClients > 0 ? totalUnselectedClients : '...'}
                </span>
              </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="px-4 md:px-5 py-3 border-b border-white/[0.07] flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" strokeWidth={1.75} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or phone..."
                  className="field !pl-9"
                />
              </div>
            </div>

            {/* Clients List */}
            <div className="overflow-y-auto flex-1 relative">
              {/* Stats - Only show on Client List tab - INSIDE SCROLLABLE CONTAINER */}
              {previewStats && activeTab === "client-list" && (
                <div className="px-4 md:px-5 py-4 border-b border-white/[0.07]">
                  <div className="flex items-center justify-between gap-3 md:gap-6">
                    <div className="grid grid-cols-2 md:flex md:gap-6 gap-3 md:gap-y-0 w-full">
                      <div>
                        <p className="stat-label mb-1">
                          Total Selected
                        </p>
                        <p className="text-lg md:text-xl font-semibold text-ivory tabular-nums">
                          {clientLimit === 0 ? 0 : activeClientCount}
                        </p>
                      </div>
                      <div>
                        <p className="stat-label mb-1">Avg Score</p>
                        <p className="text-lg md:text-xl font-semibold text-ivory tabular-nums">
                          {previewStats.avg_score}
                        </p>
                      </div>
                      <div>
                        <p className="stat-label mb-1">
                          Avg Days Since
                        </p>
                        <p className="text-lg md:text-xl font-semibold text-ivory tabular-nums">
                          {previewStats.avg_days_since_last_visit}
                        </p>
                      </div>
                      <div>
                        <p className="stat-label mb-1">
                          Avg Overdue
                        </p>
                        <p className="text-lg md:text-xl font-semibold text-ivory tabular-nums">
                          {previewStats.avg_days_overdue}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Metric Explanations */}
                  <div className="mt-3 pt-3 border-t border-white/[0.07] space-y-1.5 text-xs text-muted">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                      <div>
                        <span className="text-ivory font-medium">Score:</span>{" "}
                        Higher = more urgent
                      </div>
                      <div>
                        <span className="text-ivory font-medium">
                          Days Since:
                        </span>{" "}
                        Since last appointment
                      </div>
                      <div>
                        <span className="text-ivory font-medium">
                          Overdue:
                        </span>{" "}
                        Late based on pattern
                      </div>
                    </div>

                    {/* Client Types Legend */}
                    <div className="flex flex-wrap gap-2 md:gap-3 pt-2">
                      {previewStats.breakdown.consistent > 0 && (
                        <span className="badge badge-sage">
                          <span className="font-medium">Consistent:</span>
                          <span className="hidden sm:inline">Weekly</span>
                          <span className="tabular-nums opacity-80">
                            {previewStats.breakdown.consistent}
                          </span>
                        </span>
                      )}
                      {previewStats.breakdown["semi-consistent"] > 0 && (
                        <span className="badge badge-info">
                          <span className="font-medium">Semi:</span>
                          <span className="hidden sm:inline">2-3 weeks</span>
                          <span className="tabular-nums opacity-80">
                            {previewStats.breakdown["semi-consistent"]}
                          </span>
                        </span>
                      )}
                      {previewStats.breakdown["easy-going"] > 0 && (
                        <span className="badge badge-warn">
                          <span className="font-medium">Easy:</span>
                          <span className="hidden sm:inline">1-2 mo</span>
                          <span className="tabular-nums opacity-80">
                            {previewStats.breakdown["easy-going"]}
                          </span>
                        </span>
                      )}
                      {previewStats.breakdown.rare > 0 && (
                        <span className="badge badge-danger">
                          <span className="font-medium">Rare:</span>
                          <span className="hidden sm:inline">2+ mo</span>
                          <span className="tabular-nums opacity-80">
                            {previewStats.breakdown.rare}
                          </span>
                        </span>
                      )}
                      {previewStats.breakdown.new > 0 && (
                        <span className="badge">
                          <span className="font-medium">New</span>
                          <span className="tabular-nums opacity-80">
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
                <div className="sticky top-0 z-10 bg-surface border-b border-white/[0.07] px-4 md:px-5 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 md:gap-4 min-w-0">
                      <p className="text-[13px] text-muted truncate tabular-nums">
                        <span className="hidden sm:inline">Page {clientListPage} of {clientListTotalPages} • </span>
                        {filteredClients.length} client{filteredClients.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex gap-1.5 md:gap-2 flex-shrink-0">

                      <button
                        onClick={() => setShowAddCustomModal(true)}
                        className="btn btn-glass btn-sm !h-8 !px-2.5 !text-[13px]"
                      >
                        <span className="hidden sm:inline">Add One-time sms recipient</span>
                        <span className="sm:hidden">Add</span>
                      </button>

                      <button
                        onClick={handleResetSelections}
                        className="btn btn-ghost btn-sm !h-8 !px-2.5 !text-[13px] hover:!text-[#D99A8B]"
                      >
                        <span className="hidden sm:inline">Reset All</span>
                        <span className="sm:hidden">Reset</span>
                      </button>
                      
                      {batchSelectedForAction.size > 0 && (
                        <>
                          <div className="w-px h-6 self-center bg-white/[0.07]" />
                          <button
                            onClick={() => setBatchSelectedForAction(new Set())}
                            className="btn btn-ghost btn-sm !h-8 !px-2.5 !text-[13px]"
                          >
                            Clear
                          </button>
                          <button
                            onClick={() => handleBatchConfirm('deselect')}
                            className="btn btn-primary btn-sm !h-8 !px-2.5 !text-[13px]"
                          >
                            <span className="hidden sm:inline">Deselect {batchSelectedForAction.size}</span>
                            <span className="sm:hidden">-{batchSelectedForAction.size}</span>
                          </button>
                        </>
                      )}
                      
                      {clientListTotalPages > 1 && (
                        <>
                          <div className="w-px h-6 self-center bg-white/[0.07]" />
                          <button
                            onClick={() => setClientListPage((p) => Math.max(1, p - 1))}
                            disabled={clientListPage === 1}
                            className="btn btn-glass btn-sm !h-8 !w-8 !px-0"
                          >
                            <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
                          </button>
                          <button
                            onClick={() => setClientListPage((p) => Math.min(clientListTotalPages, p + 1))}
                            disabled={clientListPage === clientListTotalPages}
                            className="btn btn-glass btn-sm !h-8 !w-8 !px-0"
                          >
                            <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sticky Pagination - Deselected Clients */}
              {activeTab === "deselected" && (
                <div className="sticky top-0 z-10 bg-surface border-b border-white/[0.07] px-4 md:px-5 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 md:gap-4 min-w-0">
                      <p className="text-[13px] text-muted truncate tabular-nums">
                        <span className="hidden sm:inline">Page {currentPage} of {totalPages} • </span>
                        {allClients.length} client{allClients.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    
                    <div className="flex gap-1.5 md:gap-2 flex-shrink-0">
                      <button
                        onClick={handleResetSelections}
                        className="btn btn-ghost btn-sm !h-8 !px-2.5 !text-[13px] hover:!text-[#D99A8B]"
                      >
                        <span className="hidden sm:inline">Reset All</span>
                        <span className="sm:hidden">Reset</span>
                      </button>
                      
                      {batchSelectedForAction.size > 0 && (
                        <>
                          <div className="w-px h-6 self-center bg-white/[0.07]" />
                          <button
                            onClick={() => setBatchSelectedForAction(new Set())}
                            className="btn btn-ghost btn-sm !h-8 !px-2.5 !text-[13px]"
                          >
                            Clear
                          </button>
                          <button
                            onClick={() => handleBatchConfirm('select')}
                            className="btn btn-primary btn-sm !h-8 !px-2.5 !text-[13px]"
                          >
                            <span className="hidden sm:inline">Select {batchSelectedForAction.size}</span>
                            <span className="sm:hidden">+{batchSelectedForAction.size}</span>
                          </button>
                        </>
                      )}
                      
                      {totalPages > 1 && (
                        <>
                          <div className="w-px h-6 self-center bg-white/[0.07]" />
                          <button
                            onClick={() => setOtherClientsPage((p) => Math.max(1, p - 1))}
                            disabled={otherClientsPage === 1}
                            className="btn btn-glass btn-sm !h-8 !w-8 !px-0"
                          >
                            <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
                          </button>
                          <button
                            onClick={() => setOtherClientsPage((p) => Math.min(totalPages, p + 1))}
                            disabled={otherClientsPage === totalPages}
                            className="btn btn-glass btn-sm !h-8 !w-8 !px-0"
                          >
                            <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="p-3 md:p-5">
                {loadingAllClients && activeTab === "deselected" ? (
                  <div className="empty-state">
                    <div className="w-6 h-6 border-2 border-white/20 border-t-sage rounded-full animate-spin" />
                    <p>Loading clients...</p>
                  </div>
                ) : filteredClients.length === 0 ? (
                  <div className="empty-state">
                    <Users strokeWidth={1.75} />
                    <p>
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
                            className={`flex items-center gap-3 md:gap-4 p-3 md:p-3.5 border rounded-lg transition-colors ${
                              isBatchSelected
                                ? "bg-sage/[0.06] border-sage/30"
                                : isDeselected
                                ? "bg-[#D8C59A]/[0.05] border-[#D8C59A]/25"
                                : "bg-raised border-white/[0.07] hover:border-white/[0.12]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isBatchSelected}
                              onChange={() => toggleBatchSelection(client.phone_normalized)}
                              className="w-4 h-4 rounded cursor-pointer flex-shrink-0"
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold text-sm text-ivory truncate">
                                  {client.first_name} {client.last_name}
                                </h4>
                                {isDeselected && (
                                  <span className="badge badge-warn flex-shrink-0">
                                    Deselected
                                  </span>
                                )}
                                                                {selectedClients.find(c => c.phone_normalized === client.phone_normalized)?.is_custom && (
                                  <span className="badge badge-sage flex-shrink-0">
                                    One-time 
                                  </span>
                                )}
                                <span
                                  className={`badge flex-shrink-0 ${
                                    client.visiting_type === "consistent"
                                      ? "badge-sage"
                                      : client.visiting_type ===
                                          "semi-consistent"
                                        ? "badge-info"
                                        : client.visiting_type === "easy-going"
                                          ? "badge-warn"
                                          : client.visiting_type === "rare"
                                            ? "badge-danger"
                                            : ""
                                  }`}
                                >
                                  {client.visiting_type}
                                </span>
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1.5 text-xs text-muted tabular-nums">
                                <span className="truncate">{client.phone_normalized}</span>
                                <span className="hidden sm:inline text-gray-500">·</span>
                                <span className="truncate">
                                  {client.days_since_last_visit} days since visit
                                </span>
                                <span className="hidden sm:inline text-gray-500">·</span>
                                <span className="text-[#D8C59A] truncate">
                                  {client.days_overdue} days overdue
                                </span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-[13px] font-semibold text-ivory tabular-nums">
                                Score: {client.score}
                              </p>
                              {normalVisitInterval && (
                                <p className="text-xs text-gray-500 hidden sm:block tabular-nums">
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
                            className={`flex items-center gap-3 md:gap-4 p-3 md:p-3.5 border rounded-lg transition-colors ${
                              isBatchSelected
                                ? "bg-sage/[0.06] border-sage/30"
                                : isSelected
                                ? "bg-white/[0.04] border-white/[0.14]"
                                : "bg-raised border-white/[0.07] hover:border-white/[0.12]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isBatchSelected}
                              onChange={() => toggleBatchSelection(client.phone_normalized || '')}
                              className="w-4 h-4 rounded cursor-pointer flex-shrink-0"
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold text-sm text-ivory truncate">
                                  {client.first_name} {client.last_name}
                                </h4>
                                {isSelected && (
                                  <span className="badge badge-info flex-shrink-0">
                                    Selected
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1.5 text-xs text-muted tabular-nums">
                                <span className="truncate">
                                  {(client.phone_normalized || 
                                    ('phone' in client ? client.phone : '') || 
                                    "No phone") as React.ReactNode}
                                </span>
                                {client.last_appt && (
                                  <>
                                    <span className="hidden sm:inline text-gray-500">·</span>
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
                              <p className="text-xs text-muted tabular-nums">
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
                className="modal-backdrop flex items-center justify-center p-4"
                onClick={() => setShowSelectModal(false)}
              >
                <motion.div
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 8, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="modal-surface relative max-w-md w-full p-5"
                >
                  <button
                    onClick={() => setShowSelectModal(false)}
                    className="btn btn-ghost btn-sm !h-8 !px-2 absolute top-3 right-3"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                  <div className="flex items-start gap-3 mb-4 pr-8">
                    <div className="w-9 h-9 rounded-lg bg-white/[0.04] text-[#A9C0D2] flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-[18px] h-[18px]" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-semibold text-ivory mb-1">
                        Select Client?
                      </h3>
                      <p className="text-sm text-muted">
                        <span className="text-ivory font-semibold">
                          {pendingSelectClient.first_name}{" "}
                          {pendingSelectClient.last_name}
                        </span>{" "}
                        will always receive this message regardless of the
                        algorithm.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-white/[0.03] border border-white/[0.07] rounded-lg mb-4">
                    <div className="flex items-start gap-2 text-[13px] text-[#A9C0D2]">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                      <p>
                        This client will not appear on the Client List page
                        but they will receive your message.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setShowSelectModal(false);
                        setPendingSelectClient(null);
                      }}
                      className="btn btn-ghost btn-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmSelect}
                      className="btn btn-primary btn-sm"
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
                className="modal-backdrop flex items-center justify-center p-4"
                onClick={() => setShowUnselectModal(false)}
              >
                <motion.div
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 8, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="modal-surface relative max-w-md w-full p-5"
                >
                  <button
                    onClick={() => setShowUnselectModal(false)}
                    className="btn btn-ghost btn-sm !h-8 !px-2 absolute top-3 right-3"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                  <div className="flex items-start gap-3 mb-4 pr-8">
                    <div className="w-9 h-9 rounded-lg bg-[#D8C59A]/[0.12] text-[#D8C59A] flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-[18px] h-[18px]" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-semibold text-ivory mb-1">
                        Remove Selection?
                      </h3>
                      <p className="text-sm text-muted">
                        <span className="text-ivory font-semibold">
                          {pendingUnselectClient.first_name}{" "}
                          {pendingUnselectClient.last_name}
                        </span>{" "}
                        will return to being selected by the algorithm only.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-[#D8C59A]/[0.06] border border-[#D8C59A]/20 rounded-lg mb-4">
                    <div className="flex items-start gap-2 text-[13px] text-[#D8C59A]">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                      <p>
                        This client may or may not receive future messages
                        depending on the algorithm.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setShowUnselectModal(false);
                        setPendingUnselectClient(null);
                      }}
                      className="btn btn-ghost btn-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmUnselect}
                      className="btn btn-primary btn-sm"
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
                className="modal-backdrop flex items-center justify-center p-4"
                onClick={() => setShowDeselectModal(false)}
              >
                <motion.div
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 8, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="modal-surface relative max-w-md w-full p-5"
                >
                  <button
                    onClick={() => setShowDeselectModal(false)}
                    className="btn btn-ghost btn-sm !h-8 !px-2 absolute top-3 right-3"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                  <div className="flex items-start gap-3 mb-4 pr-8">
                    <div className="w-9 h-9 rounded-lg bg-[#D8C59A]/[0.12] text-[#D8C59A] flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-[18px] h-[18px]" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-semibold text-ivory mb-1">
                        Deselect Client?
                      </h3>
                      <p className="text-sm text-muted">
                        <span className="text-ivory font-semibold">
                          {pendingDeselectName}
                        </span>{" "}
                        will not receive this message and will be moved to the
                        Deselected Clients list.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-[#D8C59A]/[0.06] border border-[#D8C59A]/20 rounded-lg mb-4">
                    <div className="flex items-start gap-2 text-[13px] text-[#D8C59A]">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                      <p>
                        This client will be excluded from all future sends of
                        this campaign.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setShowDeselectModal(false);
                        setPendingDeselectPhone(null);
                        setPendingDeselectName("");
                      }}
                      className="btn btn-ghost btn-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDeselect}
                      className="btn btn-primary btn-sm"
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
                className="modal-backdrop flex items-center justify-center p-4"
                onClick={() => setShowReselectModal(false)}
              >
                <motion.div
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 8, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="modal-surface relative max-w-md w-full p-5"
                >
                  <button
                    onClick={() => setShowReselectModal(false)}
                    className="btn btn-ghost btn-sm !h-8 !px-2 absolute top-3 right-3"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                  <div className="flex items-start gap-3 mb-4 pr-8">
                    <div className="w-9 h-9 rounded-lg bg-sage/[0.14] text-sage-bright flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-[18px] h-[18px]" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-semibold text-ivory mb-1">
                        Remove from Deselected?
                      </h3>
                      <p className="text-sm text-muted">
                        <span className="text-ivory font-semibold">
                          {pendingReselectName}
                        </span>{" "}
                        will be added back to the algorithm and may receive
                        future campaign messages.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-sage/[0.06] border border-sage/20 rounded-lg mb-4">
                    <div className="flex items-start gap-2 text-[13px] text-sage-bright">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                      <p>
                        This client will be eligible to receive messages from
                        this campaign again based on the algorithm.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setShowReselectModal(false);
                        setPendingReselectPhone(null);
                        setPendingReselectName("");
                      }}
                      className="btn btn-ghost btn-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmReselect}
                      className="btn btn-primary btn-sm"
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
                className="modal-backdrop flex items-center justify-center p-4"
                onClick={() => setShowBatchConfirmModal(false)}
              >
                <motion.div
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 8, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="modal-surface relative max-w-md w-full p-5"
                >
                  <button
                    onClick={() => setShowBatchConfirmModal(false)}
                    className="btn btn-ghost btn-sm !h-8 !px-2 absolute top-3 right-3"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                  <div className="flex items-start gap-3 mb-4 pr-8">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      batchActionType === 'select' ? 'bg-white/[0.04] text-[#A9C0D2]' : 'bg-[#D8C59A]/[0.12] text-[#D8C59A]'
                    }`}>
                      <AlertCircle className="w-[18px] h-[18px]" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-semibold text-ivory mb-1">
                        {batchActionType === 'select' ? 'Select' : 'Deselect'} {batchSelectedForAction.size} Client{batchSelectedForAction.size > 1 ? 's' : ''}?
                      </h3>
                      <p className="text-sm text-muted">
                        {batchActionType === 'select' 
                          ? `${batchSelectedForAction.size} client${batchSelectedForAction.size > 1 ? 's' : ''} will always receive this message regardless of the algorithm.`
                          : `${batchSelectedForAction.size} client${batchSelectedForAction.size > 1 ? 's' : ''} will not receive this message.`
                        }
                      </p>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg mb-4 ${
                    batchActionType === 'select' ? 'bg-white/[0.03] border border-white/[0.07]' : 'bg-[#D8C59A]/[0.06] border border-[#D8C59A]/20'
                  }`}>
                    <div className={`flex items-start gap-2 text-[13px] ${
                      batchActionType === 'select' ? 'text-[#A9C0D2]' : 'text-[#D8C59A]'
                    }`}>
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                      <p>
                        {batchActionType === 'select'
                          ? 'Your selected clients will replace the lowest-scored clients on the algorithm, keeping your max the same.'
                          : 'These clients will be excluded from all future sends of this campaign.'
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setShowBatchConfirmModal(false);
                        setBatchActionType(null);
                      }}
                      className="btn btn-ghost btn-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmBatchAction}
                      className="btn btn-primary btn-sm"
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
                className="modal-backdrop flex items-center justify-center p-4"
                onClick={() => setShowResetModal(false)}
              >
                <motion.div
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 8, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="modal-surface relative max-w-md w-full p-5"
                >
                  <button
                    onClick={() => setShowResetModal(false)}
                    className="btn btn-ghost btn-sm !h-8 !px-2 absolute top-3 right-3"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                  <div className="flex items-start gap-3 mb-4 pr-8">
                    <div className="w-9 h-9 rounded-lg bg-[#D99A8B]/[0.14] text-[#D99A8B] flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-[18px] h-[18px]" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-semibold text-ivory mb-1">
                        Reset All Selections?
                      </h3>
                      <p className="text-sm text-muted">
                        This will reset all your deselected and manually selected clients. The algorithm will return to its default selection.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-[#D99A8B]/[0.08] border border-[#D99A8B]/20 rounded-lg mb-4">
                    <div className="flex items-start gap-2 text-[13px] text-[#D99A8B]">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                      <p>
                        This action cannot be undone. All custom selections will be cleared.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowResetModal(false)}
                      className="btn btn-ghost btn-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmReset}
                      className="btn btn-sm bg-[#D99A8B]/[0.14] text-[#D99A8B] shadow-[inset_0_0_0_1px_rgba(217,154,139,0.3)] hover:bg-[#D99A8B]/[0.22]"
                    >
                      Reset All
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Add Custom Client Modal */}
          <AnimatePresence>
            {showAddCustomModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="modal-backdrop flex items-center justify-center p-4"
                onClick={() => setShowAddCustomModal(false)}
              >
                <motion.div
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 8, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="modal-surface relative max-w-md w-full p-5"
                >
                  <button
                    onClick={() => setShowAddCustomModal(false)}
                    className="btn btn-ghost btn-sm !h-8 !px-2 absolute top-3 right-3"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                  <div className="flex items-start justify-between mb-4 pr-8">
                    <div>
                      <h3 className="text-[15px] font-semibold text-ivory mb-1">
                        Add One-time Recipient
                      </h3>
                      <p className="text-sm text-muted">
                        This client will receive this message once, regardless of the algorithm.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6">
                    {/* First Name */}
                    <div>
                      <label className="field-label">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={customFirstName}
                        onChange={(e) => setCustomFirstName(e.target.value)}
                        placeholder="John"
                        className="field"
                      />
                    </div>

                    {/* Last Name */}
                    <div>
                      <label className="field-label">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={customLastName}
                        onChange={(e) => setCustomLastName(e.target.value)}
                        placeholder="Doe"
                        className="field"
                      />
                    </div>

                    {/* Phone Number */}
                    <div>
                      <label className="field-label">
                        Phone Number
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted font-medium">
                          +1
                        </span>
                        <input
                          type="tel"
                          value={customPhone}
                          onChange={(e) => {
                            // Only allow digits and format as (XXX) XXX-XXXX
                            const value = e.target.value.replace(/\D/g, '');
                            if (value.length <= 10) {
                              let formatted = value;
                              if (value.length > 6) {
                                formatted = `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}`;
                              } else if (value.length > 3) {
                                formatted = `(${value.slice(0, 3)}) ${value.slice(3)}`;
                              } else if (value.length > 0) {
                                formatted = `(${value}`;
                              }
                              setCustomPhone(formatted);
                            }
                          }}
                          placeholder="(123) 456-7890"
                          maxLength={14}
                          className="field !pl-9 tabular-nums"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Enter 10-digit phone number
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-sage/[0.06] border border-sage/20 rounded-lg mb-4">
                    <div className="flex items-start gap-2 text-[13px] text-sage-bright">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                      <p>
                        This recipient will not appear in your regular client list and will only receive this specific message.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setShowAddCustomModal(false);
                        setCustomFirstName('');
                        setCustomLastName('');
                        setCustomPhone('');
                      }}
                      className="btn btn-ghost btn-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddCustomClient}
                      className="btn btn-primary btn-sm"
                    >
                      Add Recipient
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showIncreaseLimitModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="modal-backdrop z-[70] flex items-center justify-center p-4"
                onClick={() => setShowIncreaseLimitModal(false)}
              >
                <motion.div
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 8, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="modal-surface relative max-w-md w-full p-5"
                >
                  <button
                    onClick={() => setShowIncreaseLimitModal(false)}
                    className="btn btn-ghost btn-sm !h-8 !px-2 absolute top-3 right-3"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                  <div className="flex items-start gap-3 mb-4 pr-8">
                    <div className="w-9 h-9 rounded-lg bg-[#D8C59A]/[0.12] text-[#D8C59A] flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-[18px] h-[18px]" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-semibold text-ivory mb-1">
                        Increase Max Clients
                      </h3>
                      <p className="text-sm text-muted">
                        You currently have {selectedClients.length} one-time recipient{selectedClients.length !== 1 ? 's' : ''} selected, 
                        but your max clients is set to 0.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-[#D8C59A]/[0.06] border border-[#D8C59A]/20 rounded-lg mb-4">
                    <div className="flex items-start gap-2 text-[13px] text-[#D8C59A]">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                      <p>
                        To see your selected one-time recipients in the client list and add more, 
                        please increase your max clients to at least {selectedClients.length + 1}.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowIncreaseLimitModal(false)}
                      className="btn btn-primary btn-sm"
                    >
                      Got it
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