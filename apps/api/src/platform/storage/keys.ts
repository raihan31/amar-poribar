/** Object key layout. Every key starts with an owner id so erasure can delete by prefix. */

function id(value: string, label: string): string {
  if (!value || /[/\\\s]/.test(value) || value.includes("..")) {
    throw new Error(`invalid ${label}: ${JSON.stringify(value)}`);
  }
  return value;
}

export const storageKeys = {
  voice: (familyId: string, mediaId: string) => `voice/${id(familyId, "familyId")}/${id(mediaId, "mediaId")}.m4a`,
  video: (familyId: string, mediaId: string) => `video/${id(familyId, "familyId")}/${id(mediaId, "mediaId")}.mp4`,
  receipt: (familyId: string, txnId: string) => `receipt/${id(familyId, "familyId")}/${id(txnId, "txnId")}.jpg`,
  export: (userId: string, requestId: string) => `export/${id(userId, "userId")}/${id(requestId, "requestId")}.zip`,
  /** Prefixes for erasure of everything a family or user owns. */
  familyPrefixes: (familyId: string) => ["voice", "video", "receipt"].map((k) => `${k}/${id(familyId, "familyId")}/`),
  userPrefix: (userId: string) => `export/${id(userId, "userId")}/`,
};
