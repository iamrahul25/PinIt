import React, { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import imageCompression from 'browser-image-compression';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { getFullImageUrl } from '../utils/cloudinaryUrls';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import {
  MapPin, AlertTriangle, Flag, Info, User, ImagePlus, Edit3, X, Loader2
} from 'lucide-react';

const PROBLEM_TYPES = [
  { value: 'Trash Pile', label: 'Trash Pile' },
  { value: 'Pothole', label: 'Pothole' },
  { value: 'Broken Pipe', label: 'Broken Pipe' },
  { value: 'Fuse Street Light', label: 'Street Light' },
  { value: 'Other', label: 'Other' }
];

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.6,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  initialQuality: 0.75
};

const MAX_IMAGES_PER_SECTION = 10;

const getDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const formatDistance = (meters) => {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
};

const initialEditFormFromPin = (pin) => {
  const loc = pin.location;
  return {
    problemType: pin.problemType || 'Other',
    severity: pin.severity ?? 5,
    problemHeading: pin.problemHeading || '',
    description: pin.description || '',
    contributor_name: pin.contributor_name || '',
    anonymous: pin.anonymous !== false,
    location: loc ? { latitude: loc.latitude, longitude: loc.longitude, address: loc.address ?? '' } : { latitude: 0, longitude: 0, address: '' }
  };
};

export interface EditPinDetailsProps {
  pin: {
    _id: string;
    problemType?: string;
    severity?: number;
    problemHeading?: string;
    description?: string;
    contributor_name?: string;
    anonymous?: boolean;
    location?: { latitude?: number; longitude?: number; address?: string };
    images?: string[];
    imagesAfter?: string[];
  };
  onCancel: () => void;
  onSaved: (updatedPin: unknown) => void;
  onRequestRepositionPin?: (pin: unknown) => void;
  onCancelReposition?: () => void;
  isRepositioningPin?: boolean;
  newLocationForEdit?: { pinId: string; lat: number; lng: number; address?: string } | null;
  onConsumeNewLocation?: () => void;
}

const EditPinDetails = ({
  pin,
  onCancel,
  onSaved,
  onRequestRepositionPin,
  onCancelReposition,
  isRepositioningPin = false,
  newLocationForEdit = null,
  onConsumeNewLocation
}: EditPinDetailsProps) => {
  const { getToken } = useAuth();
  const [editForm, setEditForm] = useState(() => initialEditFormFromPin(pin));
  const [editImages, setEditImages] = useState<string[]>(
    pin.images && Array.isArray(pin.images) ? [...pin.images] : []
  );
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [editImagesAfter, setEditImagesAfter] = useState<string[]>(
    pin.imagesAfter && Array.isArray(pin.imagesAfter) ? [...pin.imagesAfter] : []
  );
  const [newImageFilesAfter, setNewImageFilesAfter] = useState<File[]>([]);
  const [newImagePreviewsAfter, setNewImagePreviewsAfter] = useState<string[]>([]);
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [compressingNewImages, setCompressingNewImages] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const editFileAfterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!newLocationForEdit || newLocationForEdit.pinId !== pin._id) return;
    setEditForm((prev) => ({
      ...prev,
      location: {
        latitude: newLocationForEdit.lat,
        longitude: newLocationForEdit.lng,
        address: newLocationForEdit.address || ''
      }
    }));
    onConsumeNewLocation?.();
  }, [newLocationForEdit, pin._id, onConsumeNewLocation]);

  const getAuthConfig = async (extraHeaders: Record<string, string> = {}) => {
    const token = await getToken();
    if (!token) throw new Error('Missing auth token');
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        ...extraHeaders
      }
    };
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: name === 'severity' ? parseInt(value, 10) : value
    }));
  };

  const removeEditImage = (index: number) =>
    setEditImages((prev) => prev.filter((_, i) => i !== index));
  const removeNewEditImage = (index: number) => {
    setNewImageFiles((prev) => prev.filter((_, i) => i !== index));
    setNewImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };
  const removeEditImageAfter = (index: number) =>
    setEditImagesAfter((prev) => prev.filter((_, i) => i !== index));
  const removeNewEditImageAfter = (index: number) => {
    setNewImageFilesAfter((prev) => prev.filter((_, i) => i !== index));
    setNewImagePreviewsAfter((prev) => prev.filter((_, i) => i !== index));
  };

  const handleNewEditImages = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalSlots = MAX_IMAGES_PER_SECTION - editImages.length - newImageFiles.length;
    const toAdd = files.slice(0, Math.max(0, totalSlots));
    if (toAdd.length === 0) return;
    if (e.target) e.target.value = '';
    setCompressingNewImages(true);
    try {
      const compressed = await Promise.all(toAdd.map((f) => imageCompression(f, COMPRESSION_OPTIONS)));
      setNewImageFiles((prev) => [...prev, ...compressed]);
      const start = newImageFiles.length;
      const newPreviews = await Promise.all(
        compressed.map((file) => new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result));
          reader.readAsDataURL(file);
        }))
      );
      setNewImagePreviews((prev) => [...prev.slice(0, start), ...newPreviews]);
    } catch {
      setEditError('Failed to process new images.');
    } finally {
      setCompressingNewImages(false);
    }
  }, [editImages.length, newImageFiles.length]);

  const handleNewEditImagesAfter = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalSlots = MAX_IMAGES_PER_SECTION - editImagesAfter.length - newImageFilesAfter.length;
    const toAdd = files.slice(0, Math.max(0, totalSlots));
    if (toAdd.length === 0) return;
    if (e.target) e.target.value = '';
    setCompressingNewImages(true);
    try {
      const compressed = await Promise.all(toAdd.map((f) => imageCompression(f, COMPRESSION_OPTIONS)));
      setNewImageFilesAfter((prev) => [...prev, ...compressed]);
      const start = newImageFilesAfter.length;
      const newPreviews = await Promise.all(
        compressed.map((file) => new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result));
          reader.readAsDataURL(file);
        }))
      );
      setNewImagePreviewsAfter((prev) => [...prev.slice(0, start), ...newPreviews]);
    } catch {
      setEditError('Failed to process new after images.');
    } finally {
      setCompressingNewImages(false);
    }
  }, [editImagesAfter.length, newImageFilesAfter.length]);

  const getEditImageUrl = (url: string) => {
    if (!url) return '';
    return url.startsWith('http') ? getFullImageUrl(url) : `${API_BASE_URL}/api/images/${url}`;
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const heading = (editForm.problemHeading || '').trim();
    if (!heading) {
      setEditError('Problem heading is required.');
      return;
    }
    const totalBefore = editImages.length + newImageFiles.length;
    if (totalBefore === 0) {
      setEditError('At least one before image is required.');
      return;
    }
    if (totalBefore > MAX_IMAGES_PER_SECTION) {
      setEditError(`Maximum ${MAX_IMAGES_PER_SECTION} before images allowed.`);
      return;
    }
    const totalAfter = editImagesAfter.length + newImageFilesAfter.length;
    if (totalAfter > MAX_IMAGES_PER_SECTION) {
      setEditError(`Maximum ${MAX_IMAGES_PER_SECTION} after images allowed.`);
      return;
    }
    setSavingEdit(true);
    setEditError('');
    try {
      const config = await getAuthConfig({ 'Content-Type': 'application/json' });
      const newUrls: string[] = [];
      for (const file of newImageFiles) {
        const formData = new FormData();
        formData.append('image', file);
        const uploadRes = await axios.post(
          `${API_BASE_URL}/api/images/upload`,
          formData,
          await getAuthConfig({ 'Content-Type': 'multipart/form-data' })
        );
        newUrls.push(uploadRes.data.url);
      }
      const newUrlsAfter: string[] = [];
      for (const file of newImageFilesAfter) {
        const formData = new FormData();
        formData.append('image', file);
        const uploadRes = await axios.post(
          `${API_BASE_URL}/api/images/upload`,
          formData,
          await getAuthConfig({ 'Content-Type': 'multipart/form-data' })
        );
        newUrlsAfter.push(uploadRes.data.url);
      }
      const allImages = [...editImages, ...newUrls];
      const allImagesAfter = [...editImagesAfter, ...newUrlsAfter];
      const payload = {
        problemType: editForm.problemType,
        severity: parseInt(String(editForm.severity), 10),
        problemHeading: heading,
        description: editForm.description || '',
        contributor_name: pin.contributor_name || '',
        anonymous: editForm.anonymous !== false,
        location: editForm.location || pin.location || { latitude: 0, longitude: 0, address: '' },
        images: allImages,
        imagesAfter: allImagesAfter
      };
      const response = await axios.put(`${API_BASE_URL}/api/pins/${pin._id}`, payload, config);
      onSaved(response.data);
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : 'Failed to save changes.';
      setEditError(message);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <form onSubmit={handleSaveEdit} className="space-y-6">
      <Card className="border-0 ring-0 shadow-none bg-transparent pt-[2px]">
        <CardHeader className="px-0 pt-0 pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Edit3 className="size-5 text-muted-foreground" />
            Edit pin
          </CardTitle>
          <CardDescription>Update problem details, location, and images.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-0">
          {editError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive" role="alert">
              {editError}
            </div>
          )}

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="size-4 text-muted-foreground" />
              Address
            </Label>
            <div className="space-y-2">
              <Input
                readOnly
                value={editForm.location?.address ?? pin.location?.address ?? '—'}
                className="bg-muted/50 text-muted-foreground"
                aria-readonly="true"
              />
              {onRequestRepositionPin && (
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  className="w-full gap-2"
                  onClick={() => onRequestRepositionPin(pin)}
                  disabled={isRepositioningPin}
                  title="Move pin to a new location on the map"
                  aria-label="Change location on map"
                >
                  <MapPin size={16} />
                  {isRepositioningPin ? 'Drop pin on map…' : 'Change location'}
                </Button>
              )}
            </div>
            {(() => {
              const lat = editForm.location?.latitude ?? pin.location?.latitude;
              const lng = editForm.location?.longitude ?? pin.location?.longitude;
              if (lat != null && lng != null) {
                const latNum = Number(lat);
                const lngNum = Number(lng);
                return (
                  <p className="text-xs text-muted-foreground font-mono" aria-label="GPS coordinates">
                    LAT: {latNum.toFixed(5)}° {latNum >= 0 ? 'N' : 'S'} · LONG: {lngNum.toFixed(5)}° {lngNum >= 0 ? 'E' : 'W'}
                  </p>
                );
              }
              return null;
            })()}
            {(() => {
              const oldLat = pin.location?.latitude;
              const oldLng = pin.location?.longitude;
              const newLat = editForm.location?.latitude;
              const newLng = editForm.location?.longitude;
              if (oldLat != null && oldLng != null && newLat != null && newLng != null) {
                const same =
                  Number(oldLat).toFixed(5) === Number(newLat).toFixed(5) &&
                  Number(oldLng).toFixed(5) === Number(newLng).toFixed(5);
                if (!same) {
                  const meters = getDistanceMeters(Number(oldLat), Number(oldLng), Number(newLat), Number(newLng));
                  return (
                    <p className="text-sm font-medium text-primary" role="status">
                      GPS location changed by → {formatDistance(meters)}
                    </p>
                  );
                }
              }
              return null;
            })()}
            {isRepositioningPin && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                <p className="text-sm text-muted-foreground" role="status">
                  Click on the map to drop the pin at the new location.
                </p>
                {onCancelReposition && (
                  <Button type="button" variant="secondary" size="sm" onClick={onCancelReposition}>
                    Cancel
                  </Button>
                )}
              </div>
            )}
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-problemType" className="flex items-center gap-2 text-sm font-medium">
                <Flag className="size-4 text-muted-foreground" />
                Problem type <span className="text-destructive">*</span>
              </Label>
              <select
                id="edit-problemType"
                name="problemType"
                value={editForm.problemType}
                onChange={handleEditInputChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {PROBLEM_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-severity" className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="size-4 text-muted-foreground" />
                Severity (1–10) <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-3">
                <input
                  id="edit-severity"
                  type="range"
                  name="severity"
                  min={1}
                  max={10}
                  value={editForm.severity}
                  onChange={handleEditInputChange}
                  className="h-2 w-full flex-1 cursor-pointer appearance-none rounded-full bg-primary/20 accent-primary [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-black [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-black"
                />
                <span className="min-w-[3rem] text-sm font-medium tabular-nums">{editForm.severity}/10</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-heading" className="flex items-center gap-2 text-sm font-medium">
              <Info className="size-4 text-muted-foreground" />
              Problem heading <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-heading"
              name="problemHeading"
              value={editForm.problemHeading}
              onChange={handleEditInputChange}
              placeholder="e.g. Garbage pile near the park"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description" className="text-sm font-medium">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="edit-description"
              name="description"
              value={editForm.description}
              onChange={handleEditInputChange}
              placeholder="Describe the problem..."
              rows={3}
              className="resize-y min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-postAs" className="flex items-center gap-2 text-sm font-medium">
              <User className="size-4 text-muted-foreground" />
              Post as
            </Label>
            <select
              id="edit-postAs"
              value={editForm.anonymous !== false ? 'anonymous' : 'public'}
              onChange={(e) => setEditForm((prev) => ({ ...prev, anonymous: e.target.value === 'anonymous' }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="anonymous">Anonymous User</option>
              <option value="public">Post publicly</option>
            </select>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <ImagePlus className="size-4 text-muted-foreground" />
              Before images (before fix) <span className="text-destructive">*</span>
              <span className="font-normal text-muted-foreground">(at least 1, max {MAX_IMAGES_PER_SECTION})</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {editImages.map((url, index) => (
                <div key={`existing-${index}`} className="group relative size-20 overflow-hidden rounded-lg border bg-muted">
                  <img src={getEditImageUrl(url)} alt="" className="size-full object-cover" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute right-1 top-1 size-6 rounded-full opacity-90"
                    onClick={() => removeEditImage(index)}
                    aria-label="Remove image"
                  >
                    <X size={12} />
                  </Button>
                </div>
              ))}
              {newImagePreviews.map((src, index) => (
                <div key={`new-${index}`} className="group relative size-20 overflow-hidden rounded-lg border bg-muted">
                  <img src={src} alt="" className="size-full object-cover" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute right-1 top-1 size-6 rounded-full opacity-90"
                    onClick={() => removeNewEditImage(index)}
                    aria-label="Remove image"
                  >
                    <X size={12} />
                  </Button>
                </div>
              ))}
              {editImages.length + newImageFiles.length < MAX_IMAGES_PER_SECTION && (
                <button
                  type="button"
                  disabled={compressingNewImages}
                  onClick={() => !compressingNewImages && editFileInputRef.current?.click()}
                  className="flex size-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input bg-muted/30 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                  aria-label="Add before image"
                >
                  <ImagePlus size={24} />
                  <span className="text-xs">{compressingNewImages ? 'Compressing…' : 'Add'}</span>
                </button>
              )}
            </div>
            <input
              ref={editFileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleNewEditImages}
              className="sr-only"
              aria-hidden
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <ImagePlus className="size-4 text-muted-foreground" />
              After images (after fixing){' '}
              <span className="font-normal text-muted-foreground">(optional, max {MAX_IMAGES_PER_SECTION})</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {editImagesAfter.map((url, index) => (
                <div key={`after-existing-${index}`} className="group relative size-20 overflow-hidden rounded-lg border bg-muted">
                  <img src={getEditImageUrl(url)} alt="" className="size-full object-cover" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute right-1 top-1 size-6 rounded-full opacity-90"
                    onClick={() => removeEditImageAfter(index)}
                    aria-label="Remove image"
                  >
                    <X size={12} />
                  </Button>
                </div>
              ))}
              {newImagePreviewsAfter.map((src, index) => (
                <div key={`after-new-${index}`} className="group relative size-20 overflow-hidden rounded-lg border bg-muted">
                  <img src={src} alt="" className="size-full object-cover" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute right-1 top-1 size-6 rounded-full opacity-90"
                    onClick={() => removeNewEditImageAfter(index)}
                    aria-label="Remove image"
                  >
                    <X size={12} />
                  </Button>
                </div>
              ))}
              {editImagesAfter.length + newImageFilesAfter.length < MAX_IMAGES_PER_SECTION && (
                <button
                  type="button"
                  disabled={compressingNewImages}
                  onClick={() => !compressingNewImages && editFileAfterInputRef.current?.click()}
                  className="flex size-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input bg-muted/30 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                  aria-label="Add after image"
                >
                  <ImagePlus size={24} />
                  <span className="text-xs">{compressingNewImages ? 'Compressing…' : 'Add'}</span>
                </button>
              )}
            </div>
            <input
              ref={editFileAfterInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleNewEditImagesAfter}
              className="sr-only"
              aria-hidden
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3 px-0 pb-0 mb-4">
          <Button variant="outline" type="button" onClick={onCancel} disabled={savingEdit}>
            Cancel
          </Button>
          <Button type="submit" disabled={savingEdit}>
            {savingEdit ? (
              <>
                <Loader2 className="size-4 animate-spin shrink-0" />
                <span>Saving…</span>
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
};

export default EditPinDetails;
