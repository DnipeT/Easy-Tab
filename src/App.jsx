import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

export default function App() {
  const gradients = useMemo(
    () => [
      "from-blue-500 to-cyan-400",
      "from-violet-500 to-fuchsia-400",
      "from-emerald-500 to-lime-400",
      "from-orange-500 to-amber-400",
      "from-rose-500 to-pink-400",
      "from-sky-500 to-indigo-400",
    ],
    []
  );

  const folderStyles = useMemo(
    () => [
      "bg-blue-100 text-blue-700 border-blue-200",
      "bg-violet-100 text-violet-700 border-violet-200",
      "bg-emerald-100 text-emerald-700 border-emerald-200",
      "bg-orange-100 text-orange-700 border-orange-200",
      "bg-pink-100 text-pink-700 border-pink-200",
      "bg-slate-100 text-slate-700 border-slate-200",
    ],
    []
  );

  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [openTab, setOpenTab] = useState(null);
  const [showAddTabModal, setShowAddTabModal] = useState(false);

  const [folderName, setFolderName] = useState("");
  const [tabTitle, setTabTitle] = useState("");
  const [tabDescription, setTabDescription] = useState("");

  const [draggedTabId, setDraggedTabId] = useState(null);
  const [draggedFolderId, setDraggedFolderId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedFolder =
    folders.find((folder) => folder.id === selectedFolderId) || null;

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setErrorMessage("");

    const [
      { data: foldersData, error: foldersError },
      { data: tabsData, error: tabsError },
    ] = await Promise.all([
      supabase.from("folders").select("*").order("position", { ascending: true }),
      supabase.from("tabs").select("*").order("position", { ascending: true }),
    ]);

    if (foldersError || tabsError) {
      setErrorMessage(
        foldersError?.message || tabsError?.message || "Failed to load data."
      );
      setLoading(false);
      return;
    }

    const tabsByFolder = {};
    for (const tab of tabsData || []) {
      if (!tabsByFolder[tab.folder_id]) tabsByFolder[tab.folder_id] = [];
      tabsByFolder[tab.folder_id].push(tab);
    }

    const combinedFolders = (foldersData || []).map((folder) => ({
      ...folder,
      tabs: tabsByFolder[folder.id] || [],
    }));

    setFolders(combinedFolders);

    setSelectedFolderId((currentSelectedId) => {
      if (
        currentSelectedId &&
        combinedFolders.some((folder) => folder.id === currentSelectedId)
      ) {
        return currentSelectedId;
      }
      return combinedFolders[0]?.id ?? null;
    });

    setLoading(false);
  }

  async function addFolder(e) {
    e.preventDefault();
    if (!folderName.trim()) return;

    setSaving(true);
    setErrorMessage("");

    const color = folderStyles[folders.length % folderStyles.length];
    const position = folders.length;

    const { error } = await supabase.from("folders").insert([
      {
        name: folderName.trim(),
        color,
        position,
      },
    ]);

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setFolderName("");
    await loadData();
    setSaving(false);
  }

  async function addTab(e) {
    e.preventDefault();
    if (!selectedFolder || !tabTitle.trim() || !tabDescription.trim()) {
      return false;
    }

    setSaving(true);
    setErrorMessage("");

    const color = gradients[selectedFolder.tabs.length % gradients.length];
    const position = selectedFolder.tabs.length;

    const { error } = await supabase.from("tabs").insert([
      {
        folder_id: selectedFolder.id,
        title: tabTitle.trim(),
        description: tabDescription.trim(),
        color,
        position,
      },
    ]);

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return false;
    }

    setTabTitle("");
    setTabDescription("");
    await loadData();
    setSaving(false);
    return true;
  }

  async function deleteFolder(folderId) {
    setSaving(true);
    setErrorMessage("");

    const { error } = await supabase.from("folders").delete().eq("id", folderId);

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    if (selectedFolderId === folderId) {
      setSelectedFolderId(null);
    }

    if (openTab && selectedFolderId === folderId) {
      setOpenTab(null);
    }

    await loadData();
    setSaving(false);
  }

  async function deleteTab(tabId) {
    if (!selectedFolder) return;

    setSaving(true);
    setErrorMessage("");

    const { error } = await supabase.from("tabs").delete().eq("id", tabId);

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    if (openTab?.id === tabId) {
      setOpenTab(null);
    }

    await loadData();
    setSaving(false);
  }

  function handleDragStart(tabId) {
    setDraggedTabId(tabId);
  }

  function handleDragEnd() {
    setDraggedTabId(null);
  }

  async function handleDrop(targetTabId) {
    if (!selectedFolder || draggedTabId === null || draggedTabId === targetTabId) {
      setDraggedTabId(null);
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const tabs = [...selectedFolder.tabs];
    const fromIndex = tabs.findIndex((tab) => tab.id === draggedTabId);
    const toIndex = tabs.findIndex((tab) => tab.id === targetTabId);

    if (fromIndex === -1 || toIndex === -1) {
      setDraggedTabId(null);
      setSaving(false);
      return;
    }

    const [movedTab] = tabs.splice(fromIndex, 1);
    tabs.splice(toIndex, 0, movedTab);

    const updates = tabs.map((tab, index) =>
      supabase.from("tabs").update({ position: index }).eq("id", tab.id)
    );

    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);

    if (failed?.error) {
      setErrorMessage(failed.error.message);
      setDraggedTabId(null);
      setSaving(false);
      return;
    }

    setDraggedTabId(null);
    await loadData();
    setSaving(false);
  }

  function handleFolderDragStart(folderId) {
    setDraggedFolderId(folderId);
  }

  function handleFolderDragEnd() {
    setDraggedFolderId(null);
  }

  async function handleFolderDrop(targetFolderId) {
    if (draggedFolderId === null || draggedFolderId === targetFolderId) {
      setDraggedFolderId(null);
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const updatedFolders = [...folders];
    const fromIndex = updatedFolders.findIndex(
      (folder) => folder.id === draggedFolderId
    );
    const toIndex = updatedFolders.findIndex(
      (folder) => folder.id === targetFolderId
    );

    if (fromIndex === -1 || toIndex === -1) {
      setDraggedFolderId(null);
      setSaving(false);
      return;
    }

    const [movedFolder] = updatedFolders.splice(fromIndex, 1);
    updatedFolders.splice(toIndex, 0, movedFolder);

    const updates = updatedFolders.map((folder, index) =>
      supabase.from("folders").update({ position: index }).eq("id", folder.id)
    );

    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);

    if (failed?.error) {
      setErrorMessage(failed.error.message);
      setDraggedFolderId(null);
      setSaving(false);
      return;
    }

    setDraggedFolderId(null);
    await loadData();
    setSaving(false);
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 min-h-[40px]">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Folder Tab Notes App
            </h1>

            {(loading || saving) && (
              <div
                className="h-5 w-5 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin"
                aria-label={loading ? "Loading" : "Saving"}
              />
            )}
          </div>

          <p className="text-slate-600 mt-2">
            Left side shows folders. Click a folder to see its small tabs on the
            right. Click a small tab to open a big popup.
          </p>

          {errorMessage && (
            <p className="mt-3 text-sm text-red-600">{errorMessage}</p>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-3">Folders</h2>

              <form onSubmit={addFolder} className="space-y-3 mb-5">
                <input
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="Create new folder"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-slate-400"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-2xl bg-slate-900 text-white py-3 font-semibold hover:opacity-90 transition disabled:opacity-50"
                >
                  Add folder
                </button>
              </form>

              <div className="space-y-3">
                {folders.map((folder) => (
                  <div key={folder.id} className="relative group">
                    <button
                      draggable
                      onDragStart={() => handleFolderDragStart(folder.id)}
                      onDragEnd={handleFolderDragEnd}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleFolderDrop(folder.id)}
                      onClick={() => setSelectedFolderId(folder.id)}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                        folder.color
                      } ${
                        selectedFolderId === folder.id
                          ? "ring-2 ring-slate-400"
                          : "hover:scale-[1.01]"
                      } ${draggedFolderId === folder.id ? "opacity-50 scale-95" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-base">{folder.name}</div>
                          <div className="text-sm opacity-80 mt-1">
                            {folder.tabs.length} tab
                            {folder.tabs.length === 1 ? "" : "s"}
                          </div>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => deleteFolder(folder.id)}
                      className="absolute top-3 right-3 h-7 w-7 rounded-full bg-white/80 border border-white text-slate-600 opacity-0 group-hover:opacity-100 transition"
                      title="Delete folder"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6 md:p-8">
            {selectedFolder ? (
              <>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-slate-500 mb-2">
                      Selected folder
                    </p>
                    <h2 className="text-2xl md:text-3xl font-bold">
                      {selectedFolder.name}
                    </h2>
                  </div>
                  <div className="text-sm text-slate-500">
                    {selectedFolder.tabs.length} tab
                    {selectedFolder.tabs.length === 1 ? "" : "s"} • drag to reorder
                  </div>
                </div>

                <div className="mb-8 flex justify-center">
                  <button
                    onClick={() => setShowAddTabModal(true)}
                    className="rounded-2xl bg-slate-900 text-white px-5 py-3 font-semibold hover:opacity-90 transition"
                  >
                    Add tab
                  </button>
                </div>

                {selectedFolder.tabs.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                    {selectedFolder.tabs.map((tab) => (
                      <div key={tab.id} className="relative group flex justify-center">
                        <button
                          draggable
                          onDragStart={() => handleDragStart(tab.id)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleDrop(tab.id)}
                          onClick={() => setOpenTab(tab)}
                          className={`relative w-full max-w-[120px] aspect-[0.9] rounded-[24px] shadow-sm hover:shadow-lg border border-white/60 transition-all duration-200 hover:-translate-y-1 hover:scale-[1.02] bg-gradient-to-br ${
                            tab.color
                          } overflow-hidden ${
                            draggedTabId === tab.id
                              ? "opacity-50 scale-95"
                              : "opacity-100"
                          }`}
                        >
                          <div className="absolute inset-0 bg-white/10" />
                          <div className="absolute inset-x-3 top-3 h-3 rounded-full bg-white/30" />
                          <div className="absolute inset-0 flex items-center justify-center p-3">
                            <span className="text-white font-semibold text-sm md:text-base text-center leading-tight drop-shadow-sm break-words">
                              {tab.title}
                            </span>
                          </div>
                          <div className="absolute inset-x-4 bottom-3 h-1.5 rounded-full bg-white/25" />
                        </button>

                        <button
                          onClick={() => deleteTab(tab.id)}
                          className="absolute -top-2 -right-1 h-7 w-7 rounded-full bg-white shadow border border-slate-200 text-slate-600 opacity-0 group-hover:opacity-100 transition"
                          title="Delete tab"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
                    No tabs in this folder yet.
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
                Create a folder to get started.
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddTabModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-[36px] bg-white shadow-2xl overflow-hidden">
            <div className="p-8 md:p-10 border-b border-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-slate-500 mb-3">
                    New tab
                  </p>
                  <h3 className="text-3xl md:text-4xl font-bold">Add a tab</h3>
                </div>
                <button
                  onClick={() => setShowAddTabModal(false)}
                  className="h-10 w-10 rounded-full bg-slate-100 hover:bg-slate-200 transition text-2xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                const success = await addTab(e);
                if (success) setShowAddTabModal(false);
              }}
              className="p-8 md:p-10"
            >
              <div className="space-y-5">
                <input
                  value={tabTitle}
                  onChange={(e) => setTabTitle(e.target.value)}
                  placeholder="Title tab"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none focus:ring-2 focus:ring-slate-400 text-lg"
                />

                <textarea
                  value={tabDescription}
                  onChange={(e) => setTabDescription(e.target.value)}
                  placeholder="Title description"
                  rows={8}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none focus:ring-2 focus:ring-slate-400 text-lg resize-none"
                />

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddTabModal(false)}
                    className="rounded-2xl border border-slate-300 px-6 py-3 font-semibold hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-2xl bg-slate-900 text-white px-6 py-3 font-semibold hover:opacity-90 transition disabled:opacity-50"
                  >
                    Submit
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {openTab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-[36px] bg-white shadow-2xl overflow-hidden">
            <div className={`bg-gradient-to-br ${openTab.color} p-8 md:p-10 text-white`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-white/80 mb-3">
                    Opened tab
                  </p>
                  <h3 className="text-3xl md:text-4xl font-bold">
                    {openTab.title}
                  </h3>
                </div>
                <button
                  onClick={() => setOpenTab(null)}
                  className="h-10 w-10 rounded-full bg-white/20 hover:bg-white/30 transition text-2xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-8 md:p-10">
              <p className="text-slate-700 text-base md:text-lg leading-8 whitespace-pre-wrap">
                {openTab.description}
              </p>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setOpenTab(null)}
                  className="rounded-2xl bg-slate-900 text-white px-6 py-3 font-semibold hover:opacity-90 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}