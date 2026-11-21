import { describe, it, expect, afterAll } from 'vitest';
import {
  createProjectDocDB,
  deleteProjectDocDB,
  createDocShareDB,
  getActiveDocShareDB,
  getDocShareByTokenDB,
  revokeDocShareDB,
} from '@/lib/db';

describe('Project Documentation Public Share Links', () => {
  const testDocId = `test_share_doc_${Date.now()}`;

  afterAll(async () => {
    try {
      await revokeDocShareDB(testDocId);
      await deleteProjectDocDB(testDocId);
    } catch {}
  });

  it('creates and retrieves a public share link without expiry', async () => {
    // 1. Create a document to share
    const doc = await createProjectDocDB({
      id: testDocId,
      projectId: 1,
      userId: 1,
      title: 'Public Architecture Spec',
      fileName: `${testDocId}.md`,
      filePath: '',
      folder: 'Start',
      content: '# Architecture Spec\n\nThis is a public documentation spec.',
    });
    expect(doc).not.toBeNull();
    expect(doc.id).toBe(testDocId);

    // 2. Create public share link
    const share = await createDocShareDB({
      docId: testDocId,
      projectId: 1,
      createdBy: 1,
      expiresAt: null,
    });

    expect(share).not.toBeNull();
    expect(share.docId).toBe(testDocId);
    expect(share.expiresAt).toBeNull();
    expect(typeof share.token).toBe('string');
    expect(share.token.length).toBeGreaterThan(10);

    // 3. Verify getActiveDocShareDB
    const activeShare = await getActiveDocShareDB(testDocId);
    expect(activeShare).not.toBeNull();
    expect(activeShare?.token).toBe(share.token);

    // 4. Verify lookup by public token with content
    const lookup = await getDocShareByTokenDB(share.token);
    expect(lookup).not.toBeNull();
    expect(lookup?.share.token).toBe(share.token);
    expect(lookup?.doc.id).toBe(testDocId);
    expect(lookup?.doc.title).toBe('Public Architecture Spec');
    expect(lookup?.content).toContain('This is a public documentation spec.');
  });

  it('updates share link with an expiration date', async () => {
    const oneHourLater = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const updated = await createDocShareDB({
      docId: testDocId,
      projectId: 1,
      createdBy: 1,
      expiresAt: oneHourLater,
    });

    expect(updated).not.toBeNull();
    expect(updated.expiresAt).toBe(oneHourLater);

    const activeShare = await getActiveDocShareDB(testDocId);
    expect(activeShare?.expiresAt).toBe(oneHourLater);
  });

  it('revokes public share link cleanly', async () => {
    const revoked = await revokeDocShareDB(testDocId);
    expect(revoked).toBe(true);

    const activeShare = await getActiveDocShareDB(testDocId);
    expect(activeShare).toBeNull();
  });
});
