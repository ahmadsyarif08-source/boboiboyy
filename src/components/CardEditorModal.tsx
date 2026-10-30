import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Droplets,
  Flame,
  ImagePlus,
  Leaf,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  ALL_PACK_SERIES,
  DEFAULT_BATTLE_CARDS,
  DEFAULT_SUIT_CARDS,
  deleteCustomCardDefinition,
  EFFECT_CATALOG,
  getAvailableSuitArtSets,
  getCardsForPackSeries,
  getDefaultHologramForRank,
  getHologramFinishMeta,
  getNextCustomSuitSetId,
  getSuitCardForSet,
  HOLOGRAM_FINISH_OPTIONS,
  inferEffectFromCardText,
  isBuiltInCard,
  isCardModified,
  PACK_SERIES_BY_ID,
  resetCardToDefault,
  resolveCardHologramFinish,
  upsertCardDefinition,
} from '../data/cards';
import {
  AnalyzedCardImageResult,
  CardCategory,
  CardDefinition,
  CardRank,
  ConditionMode,
  EffectKey,
  EffectPriority,
  type HologramFinish,
  SuitElement,
} from '../types/game';
import { CardVisual } from './CardVisual';

interface CardEditorModalProps {
  isOpen: boolean;
  initialCard: CardDefinition | null;
  defaultPackSeriesId?: string | null;
  defaultCategory?: CardCategory | null;
  onClose: () => void;
  onSaved: (card: CardDefinition) => void;
  onDeleted: (cardId: string) => void;
  onResetToDefault: (cardId: string) => void;
}

function compressUploadedImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('Format berkas gambar tidak didukung.'));
      img.onload = () => {
        const maxWidth = 480;
        const maxHeight = 672;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.fillStyle = '#0B1120';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function getDefaultSuitEffectText(element: SuitElement): string {
  if (element === SuitElement.AIR) {
    return 'Elemen Air mengalahkan Api, kalah terhadap Daun.';
  }
  if (element === SuitElement.API) {
    return 'Elemen Api mengalahkan Daun, kalah terhadap Air.';
  }
  return 'Elemen Daun mengalahkan Air, kalah terhadap Api.';
}

function getDefaultSuitName(element: SuitElement, setLabel?: string): string {
  const suffix = setLabel?.trim() ? ` (${setLabel.trim()})` : '';
  if (element === SuitElement.AIR) return `Suit Air${suffix}`;
  if (element === SuitElement.API) return `Suit Api${suffix}`;
  return `Suit Daun${suffix}`;
}

function convertImageSourceToDataUrl(src: string): Promise<string> {
  if (src.startsWith('data:image/')) {
    return Promise.resolve(src);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () =>
      reject(
        new Error(
          'Gambar dari tautan eksternal tidak dapat dibaca otomatis. Silakan unggah berkas gambar langsung dari perangkat.'
        )
      );
    img.onload = () => {
      const maxWidth = 480;
      const maxHeight = 672;
      let width = img.width || 480;
      let height = img.height || 672;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.max(1, Math.round(width * ratio));
        height = Math.max(1, Math.round(height * ratio));
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Gagal menyiapkan kanvas analisis gambar.'));
        return;
      }
      ctx.fillStyle = '#0B1120';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      } catch {
        reject(
          new Error(
            'Tautan gambar dibatasi oleh server asal (CORS). Unggah berkas gambar dari perangkat untuk pengisian otomatis.'
          )
        );
      }
    };
    img.src = src;
  });
}

async function requestCardImageAnalysis(params: {
  imageDataUrl: string;
  fileName?: string;
  preferredCategory?: CardCategory | null;
  targetSuitElement?: SuitElement | null;
  signal?: AbortSignal;
}): Promise<AnalyzedCardImageResult> {
  const response = await fetch('/api/cards/analyze-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageDataUrl: params.imageDataUrl,
      fileName: params.fileName,
      preferredCategory: params.preferredCategory ?? null,
      targetSuitElement: params.targetSuitElement ?? null,
    }),
    signal: params.signal,
  });

  const payload = (await response.json().catch(() => null)) as
    | { result?: AnalyzedCardImageResult; error?: string }
    | null;

  if (!response.ok || !payload?.result) {
    throw new Error(payload?.error || 'Gagal menganalisis gambar untuk mengisi kartu otomatis.');
  }

  return payload.result;
}

export const CardEditorModal: React.FC<CardEditorModalProps> = ({
  isOpen,
  initialCard,
  defaultPackSeriesId,
  defaultCategory,
  onClose,
  onSaved,
  onDeleted,
  onResetToDefault,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const batchAirInputRef = useRef<HTMLInputElement | null>(null);
  const batchApiInputRef = useRef<HTMLInputElement | null>(null);
  const batchDaunInputRef = useRef<HTMLInputElement | null>(null);

  const isEditing = Boolean(initialCard);

  const [name, setName] = useState('');
  const [numberLabel, setNumberLabel] = useState('');
  const [packSeriesId, setPackSeriesId] = useState<string>('pek-kreasi-pemain');
  const [category, setCategory] = useState<CardCategory>(CardCategory.CHARACTER);
  const [rank, setRank] = useState<CardRank>('A');
  const [image, setImage] = useState('');
  const [hp, setHp] = useState<number>(180);
  const [atk, setAtk] = useState<number>(140);
  const [effectPriority, setEffectPriority] = useState<EffectPriority>(2);
  const [effectKey, setEffectKey] = useState<EffectKey>('SHIELD_ONCE');
  const [effectText, setEffectText] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [hasCondition, setHasCondition] = useState(false);
  const [conditionMode, setConditionMode] = useState<ConditionMode>('ALL');
  const [conditionTagsInput, setConditionTagsInput] = useState('');
  const [conditionDesc, setConditionDesc] = useState('');
  const [showCustomOverlay, setShowCustomOverlay] = useState(true);
  const [hologramFinish, setHologramFinish] = useState<HologramFinish>('NONE');
  const [userManuallyPickedHolo, setUserManuallyPickedHolo] = useState(false);

  // Suit Card Upload & Set State
  const [suitUploadMode, setSuitUploadMode] = useState<'SINGLE' | 'TRIO_SET'>('SINGLE');
  const [suitElement, setSuitElement] = useState<SuitElement>(SuitElement.AIR);
  const [suitArtSetChoice, setSuitArtSetChoice] = useState<number | 'NEW'>('NEW');
  const [suitSetLabel, setSuitSetLabel] = useState<string>('');
  const [trioAirImage, setTrioAirImage] = useState<string>('');
  const [trioApiImage, setTrioApiImage] = useState<string>('');
  const [trioDaunImage, setTrioDaunImage] = useState<string>('');
  const [trioAirName, setTrioAirName] = useState<string>('Suit Air Kustom');
  const [trioApiName, setTrioApiName] = useState<string>('Suit Api Kustom');
  const [trioDaunName, setTrioDaunName] = useState<string>('Suit Daun Kustom');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [analyzingCount, setAnalyzingCount] = useState(0);
  const [autoFillSummary, setAutoFillSummary] = useState<string | null>(null);
  const [userPickedCategoryTab, setUserPickedCategoryTab] = useState<CardCategory | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const singleAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isOpen) {
      singleAbortRef.current?.abort();
      singleAbortRef.current = null;
      return;
    }
    setErrorMessage(null);
    setAutoFillSummary(null);
    setAnalyzingCount(0);
    setIsDraggingOver(false);
    setUserPickedCategoryTab(defaultCategory ?? null);

    if (initialCard) {
      setName(initialCard.name);
      setNumberLabel(initialCard.numberLabel);
      setPackSeriesId(
        initialCard.packSeriesId ??
          (initialCard.isCustom ? 'pek-kreasi-pemain' : 'pek-blazing-frost')
      );
      setCategory(initialCard.category);
      setRank(
        initialCard.category === CardCategory.SUIT
          ? 'SUIT'
          : initialCard.category === CardCategory.SUPPORT
          ? 'SUPPORT'
          : initialCard.rank === 'SUIT' || initialCard.rank === 'SUPPORT'
          ? 'B'
          : initialCard.rank
      );
      setImage(initialCard.image);
      setHp(initialCard.hp || 140);
      setAtk(initialCard.atk || 100);
      setEffectPriority(initialCard.effectPriority ?? 2);
      setEffectKey(initialCard.effectKey);
      setEffectText(initialCard.effectText);
      setTagsInput(initialCard.characterTags.join(', '));
      setHasCondition(Boolean(initialCard.condition));
      setConditionMode(initialCard.condition?.mode ?? 'ALL');
      setConditionTagsInput(initialCard.condition?.requiredTags.join(', ') ?? '');
      setConditionDesc(initialCard.condition?.description ?? '');
      setShowCustomOverlay(Boolean(initialCard.showCustomOverlay));
      setHologramFinish(resolveCardHologramFinish(initialCard));
      setUserManuallyPickedHolo(true);

      setSuitUploadMode('SINGLE');
      setSuitElement(initialCard.suitElement ?? SuitElement.AIR);
      setSuitArtSetChoice(initialCard.suitArtSet ?? 1);
      setSuitSetLabel(initialCard.suitSetLabel ?? '');
    } else {
      const targetPackId =
        defaultPackSeriesId && PACK_SERIES_BY_ID[defaultPackSeriesId]
          ? defaultPackSeriesId
          : 'pek-kreasi-pemain';
      const targetPack = PACK_SERIES_BY_ID[targetPackId];
      const nextNum = getCardsForPackSeries(targetPackId, true).length + 1;
      const prefix = targetPack?.codePrefix ?? 'KST';
      const initCat = defaultCategory ?? CardCategory.CHARACTER;
      const nextSuitSet = getNextCustomSuitSetId();

      setPackSeriesId(targetPackId);
      setCategory(initCat);

      if (initCat === CardCategory.SUIT) {
        const defaultSuitArt = getSuitCardForSet(SuitElement.AIR, 1).image;
        setSuitUploadMode('TRIO_SET');
        setSuitElement(SuitElement.AIR);
        setSuitArtSetChoice('NEW');
        setSuitSetLabel(`Edisi Kustom #${nextSuitSet}`);
        setName(`Suit Air (Edisi Kustom #${nextSuitSet})`);
        setNumberLabel(`SUIT-${nextSuitSet}A`);
        setRank('SUIT');
        setImage(defaultSuitArt);
        setEffectKey('NONE');
        setEffectText(getDefaultSuitEffectText(SuitElement.AIR));
        setTrioAirImage('');
        setTrioApiImage('');
        setTrioDaunImage('');
        setTrioAirName(`Suit Air (Edisi #${nextSuitSet})`);
        setTrioApiName(`Suit Api (Edisi #${nextSuitSet})`);
        setTrioDaunName(`Suit Daun (Edisi #${nextSuitSet})`);
        setShowCustomOverlay(true);
        setHologramFinish('NONE');
        setUserManuallyPickedHolo(false);
      } else {
        const defaultArt = DEFAULT_BATTLE_CARDS[0]?.image ?? '';
        const initRank = initCat === CardCategory.SUPPORT ? 'SUPPORT' : 'A';
        setName('');
        setNumberLabel(`${prefix}-${String(nextNum).padStart(2, '0')}`);
        setRank(initRank);
        setImage(defaultArt);
        setHp(180);
        setAtk(140);
        setEffectPriority(3);
        setEffectKey(initCat === CardCategory.SUPPORT ? 'SUPPORT_KEPAKU_PARK' : 'SHIELD_ONCE');
        setEffectText(
          initCat === CardCategory.SUPPORT
            ? 'Serangan pihak lawan pada bentrokan ini menjadi tidak efektif.'
            : 'Serangan pertama lawan tidak efektif.'
        );
        setTagsInput('BoBoiBoy');
        setHasCondition(false);
        setConditionMode('ALL');
        setConditionTagsInput('');
        setConditionDesc('');
        setShowCustomOverlay(true);
        setHologramFinish(getDefaultHologramForRank(initRank));
        setUserManuallyPickedHolo(false);
        setSuitUploadMode('SINGLE');
        setSuitElement(SuitElement.AIR);
        setSuitArtSetChoice('NEW');
        setSuitSetLabel(`Edisi Kustom #${nextSuitSet}`);
      }
    }
  }, [isOpen, initialCard, defaultPackSeriesId, defaultCategory]);

  if (!isOpen) return null;

  const suitSets = getAvailableSuitArtSets();
  const nextCustomSuitSetId = getNextCustomSuitSetId();
  const resolvedSuitSetNumber =
    suitArtSetChoice === 'NEW' ? nextCustomSuitSetId : suitArtSetChoice;

  const availableEffects = EFFECT_CATALOG.filter((item) => {
    if (category === CardCategory.SUPPORT) {
      return item.targetCategory === 'SUPPORT' || item.targetCategory === 'BOTH';
    }
    return item.targetCategory === 'CHARACTER' || item.targetCategory === 'BOTH';
  });

  const currentEffectInList = availableEffects.some((e) => e.key === effectKey);
  const isAnalyzingImage = analyzingCount > 0;
  const builtInCardCheck = initialCard ? isBuiltInCard(initialCard.id) : false;

  const applyAnalyzedResultToSingleCard = (result: AnalyzedCardImageResult) => {
    const nextCategory: CardCategory = builtInCardCheck
      ? category
      : userPickedCategoryTab ?? result.category;

    setCategory(nextCategory);
    setShowCustomOverlay(!result.hasPrintedCardFrame);

    const targetPack = PACK_SERIES_BY_ID[packSeriesId];
    const nextPackSeq = getCardsForPackSeries(packSeriesId, true).length + 1;
    const defaultPackCode = `${targetPack?.codePrefix ?? 'KST'}-${String(nextPackSeq).padStart(
      2,
      '0'
    )}`;

    if (nextCategory === CardCategory.SUIT) {
      setSuitUploadMode('SINGLE');
      setRank('SUIT');
      setSuitElement(result.suitElement);
      setName(result.name);
      if (result.suitSetLabel.trim()) {
        setSuitSetLabel((prev) =>
          !prev.trim() || /^Edisi Kustom #\d+$/i.test(prev.trim())
            ? result.suitSetLabel.trim()
            : prev
        );
      }
      if (!isEditing) {
        setNumberLabel(
          result.detectedCode.trim() || `S${resolvedSuitSetNumber}-${result.suitElement}`
        );
      } else if (result.detectedCode.trim()) {
        setNumberLabel(result.detectedCode.trim());
      }
      setEffectKey('NONE');
      setEffectText(getDefaultSuitEffectText(result.suitElement));
      return;
    }

    if (nextCategory === CardCategory.SUPPORT) {
      setRank('SUPPORT');
      setName(result.name);
      if (!isEditing) {
        setNumberLabel(result.detectedCode.trim() || defaultPackCode);
      } else if (result.detectedCode.trim()) {
        setNumberLabel(result.detectedCode.trim());
      }
      setHp(0);
      setAtk(0);
      const validSupportEffects = EFFECT_CATALOG.filter(
        (item) => item.targetCategory === 'SUPPORT' || item.targetCategory === 'BOTH'
      );
      const inferredSupport = inferEffectFromCardText(result.effectText, CardCategory.SUPPORT);
      const matchedEffect =
        (result.hasPrintedCardFrame && inferredSupport
          ? validSupportEffects.find((item) => item.key === inferredSupport.effectKey)
          : undefined) ??
        validSupportEffects.find((item) => item.key === result.effectKey) ??
        (inferredSupport
          ? validSupportEffects.find((item) => item.key === inferredSupport.effectKey)
          : undefined) ??
        validSupportEffects.find((item) => item.key === 'SUPPORT_KEPAKU_PARK') ??
        validSupportEffects[0];
      setEffectKey(matchedEffect.key);
      setEffectPriority(result.effectPriority);
      setEffectText(result.effectText || matchedEffect.defaultText);
      setTagsInput('');
      setHasCondition(false);
      setConditionTagsInput('');
      setConditionDesc('');
      return;
    }

    // CHARACTER category
    const validCharRanks: CardRank[] = ['SR', 'AR', 'S', 'A', 'B', 'C'];
    const safeCharRank: CardRank = validCharRanks.includes(result.rank) ? result.rank : 'A';
    setRank(safeCharRank);
    if (!userManuallyPickedHolo) {
      setHologramFinish(getDefaultHologramForRank(safeCharRank));
    }
    setName(result.name);
    if (!isEditing) {
      setNumberLabel(result.detectedCode.trim() || defaultPackCode);
    } else if (result.detectedCode.trim()) {
      setNumberLabel(result.detectedCode.trim());
    }
    setHp(result.hp);
    setAtk(result.atk);

    const validCharEffects = EFFECT_CATALOG.filter(
      (item) => item.targetCategory === 'CHARACTER' || item.targetCategory === 'BOTH'
    );
    const inferredChar = inferEffectFromCardText(result.effectText, CardCategory.CHARACTER);
    const matchedCharEffect =
      (result.hasPrintedCardFrame && inferredChar
        ? validCharEffects.find((item) => item.key === inferredChar.effectKey)
        : undefined) ??
      validCharEffects.find((item) => item.key === result.effectKey) ??
      (inferredChar
        ? validCharEffects.find((item) => item.key === inferredChar.effectKey)
        : undefined) ??
      validCharEffects.find((item) => item.key === 'SHIELD_ONCE') ??
      validCharEffects[0];
    setEffectKey(matchedCharEffect.key);
    setEffectPriority(result.effectPriority);
    setEffectText(result.effectText || matchedCharEffect.defaultText);
    setTagsInput(result.characterTags.join(', '));

    const shouldHaveCondition =
      result.hasCondition && result.conditionRequiredTags.length > 0;
    setHasCondition(shouldHaveCondition);
    setConditionMode(result.conditionMode);
    setConditionTagsInput(shouldHaveCondition ? result.conditionRequiredTags.join(', ') : '');
    setConditionDesc(shouldHaveCondition ? result.conditionDescription : '');
  };

  const runSingleImageAutoFill = async (sourceImage: string, fileName?: string) => {
    singleAbortRef.current?.abort();
    const controller = new AbortController();
    singleAbortRef.current = controller;

    setErrorMessage(null);
    setAutoFillSummary(null);
    setAnalyzingCount((c) => c + 1);
    try {
      const dataUrl = await convertImageSourceToDataUrl(sourceImage);
      const preferredCat = builtInCardCheck ? category : userPickedCategoryTab;
      const targetSuit =
        preferredCat === CardCategory.SUIT ? suitElement : null;
      const result = await requestCardImageAnalysis({
        imageDataUrl: dataUrl,
        fileName,
        preferredCategory: preferredCat,
        targetSuitElement: targetSuit,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      applyAnalyzedResultToSingleCard(result);
      setAutoFillSummary(result.summary);
    } catch (err) {
      if (controller.signal.aborted) return;
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Gagal mengisi atribut otomatis dari gambar. Anda tetap dapat mengisinya secara manual.'
      );
    } finally {
      setAnalyzingCount((c) => Math.max(0, c - 1));
      if (singleAbortRef.current === controller) {
        singleAbortRef.current = null;
      }
    }
  };

  const processSingleUploadedFile = async (file: File) => {
    setErrorMessage(null);
    setAutoFillSummary(null);
    setUploadingImage(true);
    let compressedDataUrl = '';
    try {
      compressedDataUrl = await compressUploadedImage(file);
      setImage(compressedDataUrl);
      if (!isEditing) {
        setShowCustomOverlay(true);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal memproses gambar.');
      setUploadingImage(false);
      return;
    }
    setUploadingImage(false);

    // Automatically analyze & populate card fields when uploading a new card (or custom card)
    if (!builtInCardCheck && compressedDataUrl) {
      await runSingleImageAutoFill(compressedDataUrl, file.name);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    await processSingleUploadedFile(file);
  };

  const handlePreviewDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (isTrioSuitMode) return;
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    await processSingleUploadedFile(file);
  };

  const handleTrioFileUpload = async (
    targetElement: SuitElement,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMessage(null);
    setUploadingImage(true);
    let compressed = '';
    try {
      compressed = await compressUploadedImage(file);
      if (targetElement === SuitElement.AIR) setTrioAirImage(compressed);
      else if (targetElement === SuitElement.API) setTrioApiImage(compressed);
      else setTrioDaunImage(compressed);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal memproses gambar Suit.');
      setUploadingImage(false);
      return;
    }
    setUploadingImage(false);

    // Auto-fill Suit slot name & series label from the uploaded image
    setAnalyzingCount((c) => c + 1);
    try {
      const result = await requestCardImageAnalysis({
        imageDataUrl: compressed,
        fileName: file.name,
        preferredCategory: CardCategory.SUIT,
        targetSuitElement: targetElement,
      });
      if (targetElement === SuitElement.AIR) {
        setTrioAirName(result.name);
      } else if (targetElement === SuitElement.API) {
        setTrioApiName(result.name);
      } else {
        setTrioDaunName(result.name);
      }
      if (result.suitSetLabel.trim()) {
        setSuitSetLabel((prev) =>
          !prev.trim() || /^Edisi Kustom #\d+$/i.test(prev.trim())
            ? result.suitSetLabel.trim()
            : prev
        );
      }
      setShowCustomOverlay(!result.hasPrintedCardFrame);
      setAutoFillSummary(result.summary);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Gambar Suit terunggah, namun gagal mengisi nama otomatis.'
      );
    } finally {
      setAnalyzingCount((c) => Math.max(0, c - 1));
    }
  };

  const parsedTags = tagsInput
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const parsedConditionTags = conditionTagsInput
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const isTrioSuitMode = !isEditing && category === CardCategory.SUIT && suitUploadMode === 'TRIO_SET';

  const previewCard: CardDefinition =
    category === CardCategory.SUIT
      ? {
          id: initialCard?.id ?? 'preview-custom-suit',
          numberLabel: numberLabel.trim() || `SUIT-${resolvedSuitSetNumber}`,
          name:
            name.trim() ||
            getDefaultSuitName(suitElement, suitSetLabel),
          category: CardCategory.SUIT,
          rank: 'SUIT',
          image: image.trim() || getSuitCardForSet(suitElement, 1).image,
          hp: 0,
          atk: 0,
          effectText: effectText.trim() || getDefaultSuitEffectText(suitElement),
          characterTags: [],
          effectKey: 'NONE',
          suitElement,
          suitArtSet: resolvedSuitSetNumber,
          suitSetLabel: suitSetLabel.trim() || undefined,
          packSeriesId,
          isCustom: initialCard ? Boolean(initialCard.isCustom) : true,
          showCustomOverlay,
          hologramFinish,
        }
      : {
          id: initialCard?.id ?? 'preview-custom-card',
          numberLabel: numberLabel.trim() || 'KUSTOM',
          name: name.trim() || 'Nama Kartu Baru',
          category,
          rank: category === CardCategory.SUPPORT ? 'SUPPORT' : rank,
          image: image.trim() || DEFAULT_BATTLE_CARDS[0].image,
          hp: category === CardCategory.CHARACTER ? Math.max(20, Number(hp) || 100) : 0,
          atk: category === CardCategory.CHARACTER ? Math.max(0, Number(atk) || 80) : 0,
          effectPriority,
          effectText: effectText.trim() || 'Tidak ada efek tambahan.',
          characterTags:
            category === CardCategory.CHARACTER
              ? parsedTags.length > 0
                ? parsedTags
                : [name.trim() || 'Karakter Kustom']
              : [],
          condition:
            category === CardCategory.CHARACTER && hasCondition && parsedConditionTags.length > 0
              ? {
                  mode: conditionMode,
                  requiredTags: parsedConditionTags,
                  description:
                    conditionDesc.trim() ||
                    `Pernah menggunakan kartu jenis ${parsedConditionTags.join(
                      conditionMode === 'ALL' ? ' & ' : ' atau '
                    )}`,
                }
              : undefined,
          effectKey,
          packSeriesId,
          isCustom: initialCard ? Boolean(initialCard.isCustom) : true,
          showCustomOverlay,
          hologramFinish,
        };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (isTrioSuitMode) {
      if (!trioAirImage && !trioApiImage && !trioDaunImage) {
        setErrorMessage(
          'Unggah minimal 1 gambar Kartu Suit (Air, Api, atau Daun) untuk membuat Seri Suit baru.'
        );
        return;
      }

      const targetSetId = resolvedSuitSetNumber;
      const cleanSetTitle = suitSetLabel.trim() || `Edisi Kustom #${targetSetId}`;
      const entries: Array<{
        el: SuitElement;
        codeSuffix: string;
        img: string;
        cardName: string;
      }> = [
        {
          el: SuitElement.AIR,
          codeSuffix: 'AIR',
          img: trioAirImage || getSuitCardForSet(SuitElement.AIR, 1).image,
          cardName: trioAirName.trim() || getDefaultSuitName(SuitElement.AIR, cleanSetTitle),
        },
        {
          el: SuitElement.API,
          codeSuffix: 'API',
          img: trioApiImage || getSuitCardForSet(SuitElement.API, 1).image,
          cardName: trioApiName.trim() || getDefaultSuitName(SuitElement.API, cleanSetTitle),
        },
        {
          el: SuitElement.DAUN,
          codeSuffix: 'DAUN',
          img: trioDaunImage || getSuitCardForSet(SuitElement.DAUN, 1).image,
          cardName: trioDaunName.trim() || getDefaultSuitName(SuitElement.DAUN, cleanSetTitle),
        },
      ];

      let lastSaved: CardDefinition | null = null;
      for (const item of entries) {
        // Replace existing custom suit card in the same set + element if present
        const existingInSet = suitSets
          .find((s) => s.id === targetSetId)
          ?.cards[item.el];
        const reuseId =
          existingInSet && existingInSet.isCustom && (existingInSet.suitArtSet ?? 1) === targetSetId
            ? existingInSet.id
            : `custom-suit-s${targetSetId}-${item.el.toLowerCase()}-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 5)}`;

        const suitCard: CardDefinition = {
          id: reuseId,
          numberLabel: `S${targetSetId}-${item.codeSuffix}`,
          name: item.cardName,
          category: CardCategory.SUIT,
          rank: 'SUIT',
          image: item.img,
          hp: 0,
          atk: 0,
          effectText: getDefaultSuitEffectText(item.el),
          characterTags: [],
          effectKey: 'NONE',
          suitElement: item.el,
          suitArtSet: targetSetId,
          suitSetLabel: cleanSetTitle,
          packSeriesId,
          isCustom: true,
          showCustomOverlay,
          hologramFinish,
        };

        const res = upsertCardDefinition(suitCard);
        if (!res.ok) {
          setErrorMessage(res.error ?? 'Gagal menyimpan paket Kartu Suit.');
          return;
        }
        lastSaved = suitCard;
      }

      if (lastSaved) {
        onSaved(lastSaved);
      }
      onClose();
      return;
    }

    if (!name.trim()) {
      setErrorMessage('Nama kartu wajib diisi.');
      return;
    }
    if (!image.trim()) {
      setErrorMessage('Silakan unggah gambar kartu atau pilih ilustrasi.');
      return;
    }

    let finalId =
      initialCard?.id ??
      `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // If uploading a single custom Suit card into an existing custom set (>3) that already has that element, update that slot cleanly
    if (!initialCard && category === CardCategory.SUIT && resolvedSuitSetNumber > 3) {
      const existingSlot = suitSets.find((s) => s.id === resolvedSuitSetNumber)?.cards[suitElement];
      if (existingSlot && existingSlot.isCustom && (existingSlot.suitArtSet ?? 1) === resolvedSuitSetNumber) {
        finalId = existingSlot.id;
      } else {
        finalId = `custom-suit-s${resolvedSuitSetNumber}-${suitElement.toLowerCase()}-${Date.now()}`;
      }
    }

    const finalCard: CardDefinition = {
      ...previewCard,
      id: finalId,
      name: name.trim(),
    };

    const result = upsertCardDefinition(finalCard);
    if (!result.ok) {
      setErrorMessage(result.error ?? 'Gagal menyimpan kartu.');
      return;
    }

    onSaved(finalCard);
    onClose();
  };

  const builtIn = initialCard ? isBuiltInCard(initialCard.id) : false;
  const modifiedBuiltIn = initialCard ? isCardModified(initialCard.id) : false;

  const trioPreviewCards: CardDefinition[] = [
    {
      id: 'trio-preview-air',
      numberLabel: `S${resolvedSuitSetNumber}-AIR`,
      name: trioAirName.trim() || 'Suit Air Kustom',
      category: CardCategory.SUIT,
      rank: 'SUIT',
      image: trioAirImage || getSuitCardForSet(SuitElement.AIR, 1).image,
      hp: 0,
      atk: 0,
      effectText: getDefaultSuitEffectText(SuitElement.AIR),
      characterTags: [],
      effectKey: 'NONE',
      suitElement: SuitElement.AIR,
      suitArtSet: resolvedSuitSetNumber,
      showCustomOverlay,
      hologramFinish,
    },
    {
      id: 'trio-preview-api',
      numberLabel: `S${resolvedSuitSetNumber}-API`,
      name: trioApiName.trim() || 'Suit Api Kustom',
      category: CardCategory.SUIT,
      rank: 'SUIT',
      image: trioApiImage || getSuitCardForSet(SuitElement.API, 1).image,
      hp: 0,
      atk: 0,
      effectText: getDefaultSuitEffectText(SuitElement.API),
      characterTags: [],
      effectKey: 'NONE',
      suitElement: SuitElement.API,
      suitArtSet: resolvedSuitSetNumber,
      showCustomOverlay,
      hologramFinish,
    },
    {
      id: 'trio-preview-daun',
      numberLabel: `S${resolvedSuitSetNumber}-DAUN`,
      name: trioDaunName.trim() || 'Suit Daun Kustom',
      category: CardCategory.SUIT,
      rank: 'SUIT',
      image: trioDaunImage || getSuitCardForSet(SuitElement.DAUN, 1).image,
      hp: 0,
      atk: 0,
      effectText: getDefaultSuitEffectText(SuitElement.DAUN),
      characterTags: [],
      effectKey: 'NONE',
      suitElement: SuitElement.DAUN,
      suitArtSet: resolvedSuitSetNumber,
      showCustomOverlay,
      hologramFinish,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/88 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#131C31] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800">
          <div>
            <div className="text-xs font-mono text-amber-400">
              {isEditing
                ? builtIn
                  ? 'Studio Kartu · Edit Kartu Bawaan'
                  : 'Studio Kartu · Edit Kartu Kustom'
                : category === CardCategory.SUIT
                ? 'Studio Kartu Suit · Upload Kartu Suit Baru (Air / Api / Daun)'
                : 'Studio Kartu · Tambah / Upload Kartu Baru'}
            </div>
            <h2 className="text-lg sm:text-xl font-display font-bold text-white">
              {isEditing
                ? `Edit Kartu: ${initialCard?.name}`
                : category === CardCategory.SUIT
                ? 'Upload Kartu Suit Baru'
                : 'Buat atau Upload Kartu Baru'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup editor kartu"
            className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 sm:p-6">
          {/* Quick Category Switcher Bar when creating a new card */}
          {!isEditing && (
            <div className="mb-5 flex flex-wrap items-center gap-2 p-1.5 bg-[#0B1120] border border-slate-800 rounded-xl">
              {(
                [
                  { id: CardCategory.CHARACTER, label: 'Kartu Karakter' },
                  { id: CardCategory.SUPPORT, label: 'Kartu Pendukung' },
                  { id: CardCategory.SUIT, label: 'Kartu Suit Baru (Air / Api / Daun)' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setUserPickedCategoryTab(tab.id);
                    setCategory(tab.id);
                    if (tab.id === CardCategory.SUIT) {
                      setRank('SUIT');
                      setEffectKey('NONE');
                      setEffectText(getDefaultSuitEffectText(suitElement));
                      if (!name.trim()) {
                        setName(
                          getDefaultSuitName(
                            suitElement,
                            suitSetLabel || `Edisi #${resolvedSuitSetNumber}`
                          )
                        );
                      }
                      if (!image.startsWith('data:')) {
                        setImage(getSuitCardForSet(suitElement, 1).image);
                      }
                    } else if (tab.id === CardCategory.SUPPORT) {
                      setRank('SUPPORT');
                      setEffectKey('SUPPORT_KEPAKU_PARK');
                      setEffectPriority(3);
                      setEffectText(
                        'Serangan pihak lawan pada bentrokan ini menjadi tidak efektif.'
                      );
                    } else {
                      setRank('A');
                      setEffectKey('SHIELD_ONCE');
                      setEffectPriority(3);
                      setEffectText('Serangan pertama lawan tidak efektif.');
                    }
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                    category === tab.id
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Live Preview & Image Upload */}
            <div
              onDragOver={(e) => {
                if (isTrioSuitMode) return;
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={handlePreviewDrop}
              className={`lg:col-span-4 flex flex-col items-center bg-[#0B1120] border rounded-2xl p-4 transition-colors ${
                isDraggingOver
                  ? 'border-amber-400 bg-amber-500/10'
                  : 'border-slate-800'
              }`}
            >
              <div className="text-xs font-semibold text-slate-400 mb-3 text-center">
                {isTrioSuitMode
                  ? 'Pratinjau Paket 3 Kartu Suit'
                  : isDraggingOver
                  ? 'Lepaskan Gambar untuk Isi Kartu Otomatis'
                  : 'Pratinjau Kartu Langsung'}
              </div>

              {isTrioSuitMode ? (
                <div className="grid grid-cols-3 gap-2 w-full justify-items-center py-2">
                  {trioPreviewCards.map((c) => (
                    <CardVisual key={c.id} card={c} size="xs" showCaption />
                  ))}
                </div>
              ) : (
                <CardVisual card={previewCard} size="lg" showCaption />
              )}

              {!isTrioSuitMode && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage || isAnalyzingImage}
                    className="mt-4 w-full py-2.5 px-4 text-xs font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                  >
                    {uploadingImage || isAnalyzingImage ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    <span>
                      {uploadingImage
                        ? 'Memproses Gambar...'
                        : isAnalyzingImage
                        ? 'Menyesuaikan Kartu...'
                        : 'Upload Gambar (Isi Otomatis)'}
                    </span>
                  </button>

                  {image.trim() && (
                    <button
                      type="button"
                      onClick={() => runSingleImageAutoFill(image)}
                      disabled={uploadingImage || isAnalyzingImage}
                      className="mt-2 w-full py-2 px-3 text-[11px] font-semibold bg-sky-500/15 hover:bg-sky-500/25 disabled:opacity-50 text-sky-200 border border-sky-400/35 rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-sky-300" />
                      <span>Sesuaikan Ulang Atribut dari Gambar</span>
                    </button>
                  )}

                  <p className="mt-2 text-[11px] leading-relaxed text-slate-400 text-center">
                    Unggah atau tarik gambar ke sini — Nama, Jenis, Rank, HP, ATK &amp; Efek akan
                    terisi otomatis menyesuaikan gambar.
                  </p>

                  <div className="mt-3 w-full">
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Atau Pilih Ilustrasi Dasar
                    </label>
                    <select
                      value={
                        [...DEFAULT_SUIT_CARDS, ...DEFAULT_BATTLE_CARDS].some(
                          (c) => c.image === image
                        )
                          ? image
                          : ''
                      }
                      onChange={(e) => {
                        if (e.target.value) setImage(e.target.value);
                      }}
                      className="w-full px-2.5 py-2 text-xs bg-[#131C31] border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                      <option value="">-- Gambar Upload / Kustom --</option>
                      {category === CardCategory.SUIT &&
                        DEFAULT_SUIT_CARDS.map((c) => (
                          <option key={c.id} value={c.image}>
                            {c.numberLabel} — {c.name}
                          </option>
                        ))}
                      {DEFAULT_BATTLE_CARDS.map((c) => (
                        <option key={c.id} value={c.image}>
                          {c.numberLabel} — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <label className="mt-3.5 w-full flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showCustomOverlay}
                  onChange={(e) => setShowCustomOverlay(e.target.checked)}
                  className="mt-0.5 rounded border-slate-600 accent-amber-500"
                />
                <span>
                  Tampilkan bingkai Nama &amp; Label di atas gambar (otomatis nonaktif bila unggahan
                  sudah berupa kartu berbingkai)
                </span>
              </label>

              {/* Selective Hologram Foil Picker right below Live Preview */}
              <div className="mt-3.5 pt-3.5 border-t border-slate-800 w-full space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>Efek Kartu Hologram</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {getHologramFinishMeta(hologramFinish).shortLabel}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {HOLOGRAM_FINISH_OPTIONS.map((opt) => {
                    const active = hologramFinish === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setHologramFinish(opt.id);
                          setUserManuallyPickedHolo(true);
                        }}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 truncate ${
                          opt.id === 'NONE' ? 'col-span-2' : ''
                        } ${
                          active
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                            : 'bg-[#131C31] hover:bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {opt.id === 'NONE' ? 'Standar (Tanpa Hologram)' : opt.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Card Attributes */}
            <div className="lg:col-span-8 space-y-4">
              {isAnalyzingImage && (
                <div className="p-3.5 rounded-xl bg-sky-500/15 border border-sky-400/40 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 text-xs text-sky-100">
                    <Loader2 className="w-4 h-4 text-sky-300 animate-spin shrink-0" />
                    <div>
                      <div className="font-bold text-sky-200">
                        Menganalisis gambar &amp; mengisi atribut kartu otomatis...
                      </div>
                      <div className="text-[11px] text-sky-200/80">
                        Menyesuaikan Nama, Rank, HP, ATK, serta Mekanisme Efek sesuai isi gambar.
                      </div>
                    </div>
                  </div>
                  {singleAbortRef.current && (
                    <button
                      type="button"
                      onClick={() => {
                        singleAbortRef.current?.abort();
                        singleAbortRef.current = null;
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-900/70 hover:bg-slate-900 text-[11px] font-semibold text-slate-300 border border-slate-700 shrink-0"
                    >
                      Lewati
                    </button>
                  )}
                </div>
              )}

              {!isAnalyzingImage && autoFillSummary && (
                <div className="p-3.5 rounded-xl bg-emerald-500/12 border border-emerald-500/35 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 text-xs text-emerald-100">
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-emerald-300">
                        Atribut Kartu Terisi Otomatis Menyesuaikan Gambar
                      </div>
                      <div className="mt-0.5 text-[11px] text-emerald-100/90 leading-relaxed">
                        {autoFillSummary} Anda masih dapat menyunting kolom mana pun sebelum
                        menyimpan.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoFillSummary(null)}
                    aria-label="Tutup pemberitahuan"
                    className="text-emerald-300/70 hover:text-emerald-200 p-0.5 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200">
                  {errorMessage}
                </div>
              )}

              {/* SUIT UPLOAD SPECIALIZED WORKFLOW */}
              {category === CardCategory.SUIT ? (
                <div className="space-y-4">
                  {!isEditing && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSuitUploadMode('TRIO_SET')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap shrink-0 ${
                          suitUploadMode === 'TRIO_SET'
                            ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                            : 'bg-[#0B1120] border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        Upload Paket 3 Kartu Suit (Air + Api + Daun)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSuitUploadMode('SINGLE')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap shrink-0 ${
                          suitUploadMode === 'SINGLE'
                            ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                            : 'bg-[#0B1120] border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        Upload 1 Kartu Suit Saja
                      </button>
                    </div>
                  )}

                  {/* Suit Set Assignment */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3.5 rounded-xl bg-[#0B1120] border border-slate-800">
                    <div className="sm:col-span-6">
                      <label className="block text-xs font-semibold text-amber-300 mb-1">
                        Target Seri Kartu Suit
                      </label>
                      <select
                        value={String(suitArtSetChoice)}
                        disabled={builtIn}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'NEW') {
                            setSuitArtSetChoice('NEW');
                            setSuitSetLabel(`Edisi Kustom #${nextCustomSuitSetId}`);
                          } else {
                            const num = Number(val);
                            setSuitArtSetChoice(num);
                            const found = suitSets.find((s) => s.id === num);
                            if (found && num > 3) {
                              const rawLabel = found.label.split('—')[1]?.trim() ?? '';
                              setSuitSetLabel(rawLabel);
                            }
                          }
                        }}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-[#131C31] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
                      >
                        {!builtIn && (
                          <option value="NEW">
                            + Buat Seri Suit Baru #{nextCustomSuitSetId}
                          </option>
                        )}
                        {suitSets
                          .filter((s) => (builtIn ? s.id === initialCard?.suitArtSet : s.id > 3))
                          .map((s) => (
                            <option key={s.id} value={String(s.id)}>
                              {s.label}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="sm:col-span-6">
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Nama Seri Suit (Muncul di Pilihan Arena)
                      </label>
                      <input
                        type="text"
                        value={suitSetLabel}
                        onChange={(e) => setSuitSetLabel(e.target.value)}
                        placeholder={`Contoh: Supra / Galaxy / Edisi #${resolvedSuitSetNumber}`}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-[#131C31] border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {isTrioSuitMode ? (
                    <div className="space-y-3">
                      <input
                        ref={batchAirInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleTrioFileUpload(SuitElement.AIR, e)}
                        className="hidden"
                      />
                      <input
                        ref={batchApiInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleTrioFileUpload(SuitElement.API, e)}
                        className="hidden"
                      />
                      <input
                        ref={batchDaunInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleTrioFileUpload(SuitElement.DAUN, e)}
                        className="hidden"
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* AIR SLOT */}
                        <div className="p-3 rounded-xl bg-[#0B1120] border border-sky-500/35 flex flex-col gap-2.5">
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-300">
                              <Droplets className="w-3.5 h-3.5" />
                              <span>SUIT AIR</span>
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {trioAirImage ? 'Terunggah' : 'Default'}
                            </span>
                          </div>
                          <input
                            type="text"
                            value={trioAirName}
                            onChange={(e) => setTrioAirName(e.target.value)}
                            placeholder="Nama Kartu Air"
                            className="w-full px-2.5 py-1.5 text-xs bg-[#131C31] border border-slate-700 rounded-lg text-white"
                          />
                          <button
                            type="button"
                            onClick={() => batchAirInputRef.current?.click()}
                            className="py-2 px-3 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{trioAirImage ? 'Ganti Gambar Air' : 'Upload Suit Air'}</span>
                          </button>
                        </div>

                        {/* API SLOT */}
                        <div className="p-3 rounded-xl bg-[#0B1120] border border-rose-500/35 flex flex-col gap-2.5">
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-300">
                              <Flame className="w-3.5 h-3.5" />
                              <span>SUIT API</span>
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {trioApiImage ? 'Terunggah' : 'Default'}
                            </span>
                          </div>
                          <input
                            type="text"
                            value={trioApiName}
                            onChange={(e) => setTrioApiName(e.target.value)}
                            placeholder="Nama Kartu Api"
                            className="w-full px-2.5 py-1.5 text-xs bg-[#131C31] border border-slate-700 rounded-lg text-white"
                          />
                          <button
                            type="button"
                            onClick={() => batchApiInputRef.current?.click()}
                            className="py-2 px-3 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{trioApiImage ? 'Ganti Gambar Api' : 'Upload Suit Api'}</span>
                          </button>
                        </div>

                        {/* DAUN SLOT */}
                        <div className="p-3 rounded-xl bg-[#0B1120] border border-emerald-500/35 flex flex-col gap-2.5">
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                              <Leaf className="w-3.5 h-3.5" />
                              <span>SUIT DAUN</span>
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {trioDaunImage ? 'Terunggah' : 'Default'}
                            </span>
                          </div>
                          <input
                            type="text"
                            value={trioDaunName}
                            onChange={(e) => setTrioDaunName(e.target.value)}
                            placeholder="Nama Kartu Daun"
                            className="w-full px-2.5 py-1.5 text-xs bg-[#131C31] border border-slate-700 rounded-lg text-white"
                          />
                          <button
                            type="button"
                            onClick={() => batchDaunInputRef.current?.click()}
                            className="py-2 px-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{trioDaunImage ? 'Ganti Gambar Daun' : 'Upload Suit Daun'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-slate-300">
                        Ketiga Kartu Suit akan disimpan sebagai{' '}
                        <strong className="text-amber-300">
                          Seri Suit #{resolvedSuitSetNumber}
                        </strong>{' '}
                        dan langsung dapat dipilih di Arena Duel, Atur Dek, Arena Custom, serta
                        Multiplayer Online (otomatis tersinkronisasi ke layar lawan &amp; Wasit).
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Single Suit Card Fields */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Pilih Elemen Kartu Suit *
                        </label>
                        <div className="grid grid-cols-3 gap-2.5">
                          {(
                            [
                              {
                                el: SuitElement.AIR,
                                label: 'AIR',
                                desc: 'Kalahkan Api',
                                activeCls: 'bg-sky-500/20 border-sky-400 text-sky-200',
                              },
                              {
                                el: SuitElement.API,
                                label: 'API',
                                desc: 'Kalahkan Daun',
                                activeCls: 'bg-rose-500/20 border-rose-400 text-rose-200',
                              },
                              {
                                el: SuitElement.DAUN,
                                label: 'DAUN',
                                desc: 'Kalahkan Air',
                                activeCls: 'bg-emerald-500/20 border-emerald-400 text-emerald-200',
                              },
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.el}
                              type="button"
                              disabled={builtIn}
                              onClick={() => {
                                setSuitElement(opt.el);
                                setEffectText(getDefaultSuitEffectText(opt.el));
                                if (!isEditing) {
                                  setName(getDefaultSuitName(opt.el, suitSetLabel));
                                  setNumberLabel(`S${resolvedSuitSetNumber}-${opt.el}`);
                                  if (!image.startsWith('data:')) {
                                    setImage(getSuitCardForSet(opt.el, 1).image);
                                  }
                                }
                              }}
                              className={`p-2.5 rounded-xl border text-left transition-colors disabled:opacity-60 ${
                                suitElement === opt.el
                                  ? opt.activeCls
                                  : 'bg-[#0B1120] border-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              <div className="text-xs font-display font-extrabold">{opt.label}</div>
                              <div className="text-[10px] opacity-80">{opt.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="sm:col-span-6">
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Nama Kartu Suit *
                          </label>
                          <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Contoh: Suit Api (Halilintar Merah)"
                            className="w-full px-3.5 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Kode Kartu
                          </label>
                          <input
                            type="text"
                            value={numberLabel}
                            onChange={(e) => setNumberLabel(e.target.value)}
                            placeholder={`S${resolvedSuitSetNumber}-${suitElement}`}
                            className="w-full px-3 py-2 text-sm font-mono bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-xs font-semibold text-amber-300 mb-1">
                            Seri Pek
                          </label>
                          <select
                            value={packSeriesId}
                            onChange={(e) => setPackSeriesId(e.target.value)}
                            className="w-full px-2.5 py-2 text-xs bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                          >
                            {ALL_PACK_SERIES.map((pack) => (
                              <option key={pack.id} value={pack.id}>
                                {pack.codePrefix} · {pack.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          URL Gambar Suit (Opsional jika tidak upload dari perangkat)
                        </label>
                        <div className="relative">
                          <ImagePlus className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={image.startsWith('data:') ? '' : image}
                            onChange={(e) => setImage(e.target.value)}
                            placeholder={
                              image.startsWith('data:')
                                ? 'Menggunakan gambar hasil upload perangkat'
                                : 'https://... atau /assets/...'
                            }
                            className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-[#0B1120] border border-slate-700 rounded-xl text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* CHARACTER & SUPPORT WORKFLOW */
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-5">
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Nama Kartu *
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Contoh: BoBoiBoy Supra / Kapten Kaizo"
                        className="w-full px-3.5 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-semibold text-amber-300 mb-1">
                        Seri Pek Kartu
                      </label>
                      <select
                        value={packSeriesId}
                        onChange={(e) => {
                          const nextId = e.target.value;
                          setPackSeriesId(nextId);
                          if (!isEditing) {
                            const targetPack = PACK_SERIES_BY_ID[nextId];
                            if (targetPack) {
                              const nextNum = getCardsForPackSeries(nextId, false).length + 1;
                              setNumberLabel(
                                `${targetPack.codePrefix}-${String(nextNum).padStart(2, '0')}`
                              );
                            }
                          }
                        }}
                        className="w-full px-3 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                      >
                        {ALL_PACK_SERIES.map((pack) => (
                          <option key={pack.id} value={pack.id}>
                            {pack.name} ({pack.codePrefix})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Kode / Nomor
                      </label>
                      <input
                        type="text"
                        value={numberLabel}
                        onChange={(e) => setNumberLabel(e.target.value)}
                        placeholder="KST-01"
                        className="w-full px-3 py-2 text-sm font-mono bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Jenis Kartu
                      </label>
                      <select
                        value={category}
                        disabled={builtIn}
                        onChange={(e) => {
                          const nextCat = e.target.value as CardCategory;
                          setCategory(nextCat);
                          if (nextCat === CardCategory.SUPPORT) {
                            setRank('SUPPORT');
                            setEffectKey('SUPPORT_KEPAKU_PARK');
                            setEffectPriority(3);
                            setEffectText(
                              'Serangan pihak lawan pada bentrokan ini menjadi tidak efektif.'
                            );
                          } else if (nextCat === CardCategory.SUIT) {
                            setRank('SUIT');
                            setEffectKey('NONE');
                            setEffectText(getDefaultSuitEffectText(suitElement));
                          } else {
                            setRank('A');
                            setEffectKey('SHIELD_ONCE');
                            setEffectPriority(3);
                            setEffectText('Serangan pertama lawan tidak efektif.');
                          }
                        }}
                        className="w-full px-3 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
                      >
                        <option value={CardCategory.CHARACTER}>Kartu Karakter</option>
                        <option value={CardCategory.SUPPORT}>Kartu Pendukung</option>
                        <option value={CardCategory.SUIT}>Kartu Suit (Air / Api / Daun)</option>
                      </select>
                    </div>

                    {category === CardCategory.CHARACTER && (
                      <>
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Rank Karakter
                          </label>
                          <select
                            value={rank}
                            onChange={(e) => {
                              const nextRank = e.target.value as CardRank;
                              setRank(nextRank);
                              if (!userManuallyPickedHolo) {
                                setHologramFinish(getDefaultHologramForRank(nextRank));
                              }
                            }}
                            className="w-full px-3 py-2 text-sm font-mono bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                          >
                            <option value="SR">SR (Super Rare)</option>
                            <option value="AR">AR (Art Rare)</option>
                            <option value="S">Rank S</option>
                            <option value="A">Rank A</option>
                            <option value="B">Rank B</option>
                            <option value="C">Rank C</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Urutan Prioritas Efek
                          </label>
                          <select
                            value={effectPriority}
                            onChange={(e) =>
                              setEffectPriority(Number(e.target.value) as EffectPriority)
                            }
                            className="w-full px-3 py-2 text-sm font-mono bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                          >
                            <option value={1}>Efek 01 (Pembatal)</option>
                            <option value={2}>Efek 02 (Buff / Ambil)</option>
                            <option value={3}>Efek 03 (Serang / Perisai)</option>
                          </select>
                        </div>
                      </>
                    )}

                    {category === CardCategory.SUPPORT && (
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Urutan Prioritas Efek Pendukung
                        </label>
                        <select
                          value={effectPriority}
                          onChange={(e) =>
                            setEffectPriority(Number(e.target.value) as EffectPriority)
                          }
                          className="w-full px-3 py-2 text-sm font-mono bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                        >
                          <option value={1}>Efek 01 (Pembatal Pendukung)</option>
                          <option value={2}>Efek 02 (Buff / Tarik Kartu)</option>
                          <option value={3}>Efek 03 (Perisai / Lemahkan Lawan)</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {category === CardCategory.CHARACTER && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-rose-300 mb-1">
                          HP Dasar (Kelipatan 20)
                        </label>
                        <input
                          type="number"
                          min={20}
                          max={900}
                          step={20}
                          value={hp}
                          onChange={(e) => setHp(Number(e.target.value))}
                          className="w-full px-3.5 py-2 text-sm font-mono tabular-nums bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-emerald-300 mb-1">
                          ATK Dasar (Kelipatan 20)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={900}
                          step={20}
                          value={atk}
                          onChange={(e) => setAtk(Number(e.target.value))}
                          className="w-full px-3.5 py-2 text-sm font-mono tabular-nums bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Mekanisme Efek Pertarungan
                    </label>
                    <select
                      value={effectKey}
                      onChange={(e) => {
                        const selectedKey = e.target.value as EffectKey;
                        setEffectKey(selectedKey);
                        const found = EFFECT_CATALOG.find((item) => item.key === selectedKey);
                        if (found) {
                          setEffectPriority(found.defaultPriority);
                          setEffectText(found.defaultText);
                        }
                      }}
                      className="w-full px-3.5 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                    >
                      {!currentEffectInList && initialCard && (
                        <option value={initialCard.effectKey}>
                          Efek Bawaan Khusus ({initialCard.name})
                        </option>
                      )}
                      {availableEffects.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Deskripsi Efek di Kartu
                    </label>
                    <textarea
                      rows={2}
                      value={effectText}
                      onChange={(e) => setEffectText(e.target.value)}
                      placeholder="Tuliskan penjelasan efek kartu..."
                      className="w-full px-3.5 py-2 text-sm bg-[#0B1120] border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    />
                    {(() => {
                      const inferred = inferEffectFromCardText(effectText, category);
                      if (!inferred || inferred.effectKey === effectKey) return null;
                      const suggestedEntry = availableEffects.find(
                        (item) => item.key === inferred.effectKey
                      );
                      if (!suggestedEntry) return null;
                      return (
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                          <span>
                            Teks cocok dengan mekanisme:{' '}
                            <strong className="text-amber-300">{suggestedEntry.label}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEffectKey(suggestedEntry.key);
                              setEffectPriority(inferred.priority);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors whitespace-nowrap shrink-0"
                          >
                            Sesuaikan Mekanisme
                          </button>
                        </div>
                      );
                    })()}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      URL Gambar (Opsional jika tidak upload berkas)
                    </label>
                    <div className="relative">
                      <ImagePlus className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={image.startsWith('data:') ? '' : image}
                        onChange={(e) => setImage(e.target.value)}
                        placeholder={
                          image.startsWith('data:')
                            ? 'Menggunakan gambar hasil upload perangkat'
                            : 'https://... atau /assets/...'
                        }
                        className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-[#0B1120] border border-slate-700 rounded-xl text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {category === CardCategory.CHARACTER && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Tag Karakter (pisahkan dengan koma, dipakai untuk membuka Kartu Bersyarat)
                        </label>
                        <input
                          type="text"
                          value={tagsInput}
                          onChange={(e) => setTagsInput(e.target.value)}
                          placeholder="BoBoiBoy, BoBoiBoy Halilintar"
                          className="w-full px-3.5 py-2 text-xs bg-[#0B1120] border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="p-3.5 rounded-xl bg-[#0B1120] border border-slate-800 space-y-3">
                        <label className="flex items-center gap-2 text-xs font-semibold text-amber-300 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={hasCondition}
                            onChange={(e) => setHasCondition(e.target.checked)}
                            className="rounded border-slate-600 accent-amber-500"
                          />
                          <span>
                            Jadikan Kartu Bersyarat (Butuh Karakter Prasyarat di Ronde Sebelumnya)
                          </span>
                        </label>

                        {hasCondition && (
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                            <div className="sm:col-span-4">
                              <label className="block text-[11px] text-slate-400 mb-1">
                                Tipe Syarat
                              </label>
                              <select
                                value={conditionMode}
                                onChange={(e) => setConditionMode(e.target.value as ConditionMode)}
                                className="w-full px-2.5 py-2 text-xs bg-[#131C31] border border-slate-700 rounded-lg text-white"
                              >
                                <option value="ALL">Semua Tag Terpenuhi</option>
                                <option value="ANY">Salah Satu Tag</option>
                              </select>
                            </div>
                            <div className="sm:col-span-8">
                              <label className="block text-[11px] text-slate-400 mb-1">
                                Tag Karakter Prasyarat (pisahkan koma)
                              </label>
                              <input
                                type="text"
                                value={conditionTagsInput}
                                onChange={(e) => setConditionTagsInput(e.target.value)}
                                placeholder="Contoh: BoBoiBoy Solar, BoBoiBoy Halilintar"
                                className="w-full px-3 py-2 text-xs bg-[#131C31] border border-slate-700 rounded-lg text-white"
                              />
                            </div>
                            <div className="sm:col-span-12">
                              <label className="block text-[11px] text-slate-400 mb-1">
                                Keterangan Syarat (Opsional)
                              </label>
                              <input
                                type="text"
                                value={conditionDesc}
                                onChange={(e) => setConditionDesc(e.target.value)}
                                placeholder="Pernah menurunkan BoBoiBoy Solar & BoBoiBoy Halilintar"
                                className="w-full px-3 py-2 text-xs bg-[#131C31] border border-slate-700 rounded-lg text-white"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {initialCard && !builtIn && (
                <button
                  type="button"
                  onClick={() => {
                    deleteCustomCardDefinition(initialCard.id);
                    onDeleted(initialCard.id);
                    onClose();
                  }}
                  className="px-3.5 py-2.5 text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Kartu Kustom</span>
                </button>
              )}

              {initialCard && builtIn && modifiedBuiltIn && (
                <button
                  type="button"
                  onClick={() => {
                    resetCardToDefault(initialCard.id);
                    onResetToDefault(initialCard.id);
                    onClose();
                  }}
                  className="px-3.5 py-2.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Kembalikan ke Asli</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={uploadingImage || isAnalyzingImage}
                className="px-5 py-2.5 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                {isAnalyzingImage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>
                  {isAnalyzingImage
                    ? 'Mengisi Atribut Otomatis...'
                    : isEditing
                    ? 'Simpan Perubahan Kartu'
                    : isTrioSuitMode
                    ? `Simpan Paket 3 Suit (Seri #${resolvedSuitSetNumber})`
                    : category === CardCategory.SUIT
                    ? 'Simpan Kartu Suit Baru'
                    : 'Tambahkan Kartu ke Koleksi'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
