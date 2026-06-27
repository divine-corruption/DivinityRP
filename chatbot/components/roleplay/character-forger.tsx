"use client";

import { Hammer, Download, Sparkles, Loader2, Upload, X, ImageIcon } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { useRoleplay } from "@/lib/roleplay-store";

interface ForgedCharacter {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  tags: string[];
  system_prompt_override?: string;
  alternate_greetings?: string[];
  creator_notes?: string;
  image_analysis: {
    scene: string;
    url: string;
    description: string;
  }[];
}

const SCENES = [
  { key: "Portrait", label: "Portrait", hint: "Face, expression, clothing" },
  { key: "Action", label: "Action", hint: "Pose, movement, activity" },
  { key: "Environment", label: "Environment", hint: "Setting, background, props" },
  { key: "Mood", label: "Mood", hint: "Atmosphere, lighting, tone" },
] as const;

export function CharacterForger() {
  const { importCharacter } = useRoleplay();
  const [concept, setConcept] = useState("");
  const [name, setName] = useState("");
  const [appearance, setAppearance] = useState("");
  const [personality, setPersonality] = useState("");
  const [backstory, setBackstory] = useState("");
  const [images, setImages] = useState<Record<string, { file: File; preview: string; url: string } | null>>({
    Portrait: null,
    Action: null,
    Environment: null,
    Mood: null,
  });
  const [uploading, setUploading] = useState<string | null>(null);
  const [forging, setForging] = useState(false);
  const [result, setResult] = useState<ForgedCharacter | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeSceneRef = useRef<string>("");

  const triggerUpload = (scene: string) => {
    activeSceneRef.current = scene;
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const scene = activeSceneRef.current;
    if (!file || !scene) return;

    const preview = URL.createObjectURL(file);
    setImages((prev) => ({ ...prev, [scene]: { file, preview, url: "" } }));
    setUploading(scene);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      setImages((prev) => ({
        ...prev,
        [scene]: prev[scene] ? { ...prev[scene]!, url: data.url } : null,
      }));
      toast.success(`${scene} image uploaded`);
    } catch {
      toast.error(`Failed to upload ${scene} image`);
      setImages((prev) => ({ ...prev, [scene]: null }));
    } finally {
      setUploading(null);
    }

    e.target.value = "";
  };

  const removeImage = (scene: string) => {
    const prev = images[scene];
    if (prev) URL.revokeObjectURL(prev.preview);
    setImages((prev) => ({ ...prev, [scene]: null }));
  };

  const allImagesReady = SCENES.every((s) => {
    const img = images[s.key];
    return img && img.url;
  });

  const handleForge = async () => {
    if (!concept.trim()) {
      toast.error("Enter at least a concept");
      return;
    }
    if (!allImagesReady) {
      toast.error("Upload all 4 reference images first");
      return;
    }

    setResult(null);
    setForging(true);

    try {
      const reference_images = SCENES.map((s) => ({
        scene: s.key,
        url: images[s.key]!.url,
      }));

      const res = await fetch("/api/forge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept,
          name: name || undefined,
          appearance: appearance || undefined,
          personality: personality || undefined,
          backstory: backstory || undefined,
          reference_images,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Forging failed");
      }

      const data: ForgedCharacter = await res.json();
      setResult(data);
      toast.success(`Forged: ${data.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Forging failed");
    } finally {
      setForging(false);
    }
  };

  const handleExport = () => {
    if (!result) return;
    const characterData = {
      name: result.name,
      description: result.description,
      personality: result.personality,
      scenario: result.scenario,
      first_mes: result.first_mes,
      mes_example: result.mes_example,
      tags: result.tags,
      system_prompt_override: result.system_prompt_override,
      alternate_greetings: result.alternate_greetings,
      creator_notes: result.creator_notes,
      avatar: result.image_analysis[0]?.url,
      images: result.image_analysis.map((ia) => ({
        url: ia.url,
        caption: `${ia.scene}: ${ia.description.slice(0, 100)}`,
      })),
    };
    const blob = new Blob([JSON.stringify(characterData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Character exported");
  };

  const handleImportToEngine = () => {
    if (!result) return;
    const char = importCharacter({
      name: result.name,
      description: result.description,
      personality: result.personality,
      scenario: result.scenario,
      first_mes: result.first_mes,
      mes_example: result.mes_example,
      tags: result.tags,
      avatar: result.image_analysis[0]?.url,
      images: result.image_analysis.map((ia) => ({
        url: ia.url,
        caption: `${ia.scene}: ${ia.description.slice(0, 80)}`,
      })),
    });
    toast.success(`Imported ${char.name} into engine`);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Character Forger</h1>
        <p className="text-sm text-muted-foreground">
          Upload 4 reference images — xAI Grok 4.3 visualizes and compiles your character
        </p>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Input side */}
        <div className="space-y-5">
          {/* 4 image upload slots */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              4 Reference Images
            </label>
            <div className="grid grid-cols-2 gap-3">
              {SCENES.map((s) => {
                const img = images[s.key];
                const isUploading = uploading === s.key;
                return (
                  <div
                    key={s.key}
                    className={`relative overflow-hidden rounded-xl border ${img ? "border-primary/40" : "border-dashed border-border/30"} bg-card`}
                  >
                    {img ? (
                      <>
                        <div className="aspect-square overflow-hidden bg-muted">
                          <img
                            src={img.preview}
                            alt={s.label}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeImage(s.key)}
                          className="absolute right-1.5 top-1.5 rounded-full bg-background/80 p-1 text-foreground transition-colors hover:bg-background"
                        >
                          <X className="size-3" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => triggerUpload(s.key)}
                        disabled={isUploading}
                        className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 text-center transition-colors hover:bg-accent disabled:opacity-50"
                      >
                        {isUploading ? (
                          <Loader2 className="size-5 animate-spin text-muted-foreground" />
                        ) : (
                          <Upload className="size-5 text-muted-foreground" />
                        )}
                        <span className="text-xs font-medium">{s.label}</span>
                        <span className="px-2 text-[10px] text-muted-foreground">
                          {s.hint}
                        </span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Text inputs */}
          <div>
            <label className="text-sm font-medium">Concept *</label>
            <textarea
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="A fallen angel haunted by memories of a war she lost, now wandering the mortal realm as a bartender..."
              rows={3}
              className="mt-1 w-full rounded-lg border border-border/30 bg-background px-3 py-2 text-sm resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Seraphina"
                className="mt-1 w-full rounded-lg border border-border/30 bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Appearance</label>
              <input
                value={appearance}
                onChange={(e) => setAppearance(e.target.value)}
                placeholder="Silver hair, amber eyes, faded wings"
                className="mt-1 w-full rounded-lg border border-border/30 bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Personality</label>
            <textarea
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="Reserved, melancholic, fiercely protective..."
              rows={2}
              className="mt-1 w-full rounded-lg border border-border/30 bg-background px-3 py-2 text-sm resize-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Backstory</label>
            <textarea
              value={backstory}
              onChange={(e) => setBackstory(e.target.value)}
              placeholder="Brief history of the character..."
              rows={3}
              className="mt-1 w-full rounded-lg border border-border/30 bg-background px-3 py-2 text-sm resize-none"
            />
          </div>

          <button
            type="button"
            onClick={handleForge}
            disabled={forging || !concept.trim() || !allImagesReady}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {forging ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Hammer className="size-4" />
            )}
            {forging ? "Grok 4.3 is analyzing images & forging..." : "Forge Character"}
          </button>
        </div>

        {/* Output side */}
        <div>
          {!result && !forging && (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/30">
              <div className="text-center">
                <Sparkles className="mx-auto mb-3 size-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Upload 4 reference images, enter a concept, and forge —<br />
                  Grok 4.3 will analyze the visuals and compile a complete character card
                </p>
              </div>
            </div>
          )}

          {forging && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto mb-3 size-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Analyzing images & building character card...
                </p>
              </div>
            </div>
          )}

          {result && !forging && (
            <div className="rounded-xl border border-border/30 bg-card">
              <div className="border-b border-border/20 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold">{result.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {result.tags?.join(", ")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleImportToEngine}
                      className="rounded-lg bg-foreground px-3 py-1.5 text-xs text-background transition-opacity hover:opacity-90"
                    >
                      Import
                    </button>
                    <button
                      type="button"
                      onClick={handleExport}
                      className="rounded-lg border border-border/30 px-3 py-1.5 text-xs transition-colors hover:bg-accent"
                    >
                      <Download className="inline size-3.5 mr-1" />
                      Export
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-4 text-sm">
                {result.image_analysis && result.image_analysis.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">
                      4 Reference Images
                    </span>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {result.image_analysis.map((ia, i) => (
                        <div key={i} className="overflow-hidden rounded-lg border border-border/20">
                          <div className="aspect-square overflow-hidden bg-muted">
                            {ia.url ? (
                              <img
                                src={ia.url}
                                alt={ia.scene}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <ImageIcon className="size-6 text-muted-foreground/30" />
                              </div>
                            )}
                          </div>
                          <div className="p-2">
                            <p className="text-[11px] font-medium">{ia.scene}</p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">
                              {ia.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.description && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Description</span>
                    <p className="mt-0.5">{result.description}</p>
                  </div>
                )}
                {result.personality && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Personality</span>
                    <p className="mt-0.5 whitespace-pre-wrap">{result.personality}</p>
                  </div>
                )}
                {result.scenario && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Scenario</span>
                    <p className="mt-0.5 whitespace-pre-wrap">{result.scenario}</p>
                  </div>
                )}
                {result.first_mes && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">First Message</span>
                    <div className="mt-0.5 rounded-lg bg-muted/50 p-3 italic text-xs">
                      {result.first_mes}
                    </div>
                  </div>
                )}
                {result.creator_notes && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Creator Notes</span>
                    <p className="mt-0.5 text-xs">{result.creator_notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
