'use client';

import { AlertCircle, Download, Eye, FileText, Image, Mail, MailX, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface NotificationDetailRecord {
  title: string;
  content?: string | null;
  sender_name?: string | null;
  type?: string | null;
  email_sent: number;
  email_error?: string | null;
  attachment_file?: string | null;
  attachment_file_name?: string | null;
}

export function isRecruitmentNotification(notification: NotificationDetailRecord) {
  const title = notification.title || '';
  const senderName = notification.sender_name || '';
  return (
    notification.type === 'recruitment' ||
    title.includes('简历投递') ||
    (title.includes('简历') && senderName.includes('人力资源'))
  );
}

function parseKeyValueLines(content?: string | null) {
  return String(content || '')
    .split('\n')
    .map((rawLine) => {
      const line = rawLine.trim();
      if (!line) return null;
      const zhIndex = line.indexOf('：');
      const asciiIndex = line.indexOf(':');
      const splitIndex = zhIndex >= 0 && asciiIndex >= 0 ? Math.min(zhIndex, asciiIndex) : Math.max(zhIndex, asciiIndex);
      if (splitIndex <= 0) return null;
      return [line.slice(0, splitIndex).trim(), line.slice(splitIndex + 1).trim()] as const;
    })
    .filter((item): item is readonly [string, string] => Boolean(item));
}

function attachmentDisplayName(notification: NotificationDetailRecord) {
  return (
    notification.attachment_file_name ||
    notification.attachment_file?.split('/').filter(Boolean).pop() ||
    '附件'
  );
}

function AttachmentIcon({ isPdf }: { isPdf: boolean }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-100">
      {isPdf ? <FileText className="h-6 w-6 text-red-500" /> : <Image className="h-6 w-6 text-blue-500" />}
    </div>
  );
}

export function NotificationDetailSections({
  notification,
  onDownloadAttachment,
}: {
  notification: NotificationDetailRecord;
  onDownloadAttachment: (fileUrl: string, fileName: string) => void;
}) {
  const recruitment = isRecruitmentNotification(notification);
  const fields = parseKeyValueLines(notification.content);
  const resumeFields = fields.filter(([label]) => !label.includes('简历'));
  const attachmentName = attachmentDisplayName(notification);
  const isPdf = attachmentName.toLowerCase().endsWith('.pdf') || String(notification.attachment_file || '').toLowerCase().endsWith('.pdf');

  return (
    <>
      {notification.content && (
        recruitment && resumeFields.length > 0 ? (
          <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-4">
            <h4 className="mb-3 font-medium">简历投递信息</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {resumeFields.map(([label, value]) => (
                <div key={label} className="rounded-md bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 break-all text-sm font-medium text-slate-800">{value || '-'}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-gray-50 p-4">
            <h4 className="mb-2 font-medium">通知内容:</h4>
            <p className="whitespace-pre-wrap break-words text-gray-700">{notification.content}</p>
          </div>
        )
      )}

      {notification.attachment_file && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <h4 className="mb-3 flex items-center gap-2 font-medium">
            <Paperclip className="h-4 w-4" />
            {recruitment ? '简历附件' : '附件信息'}
          </h4>
          <div className="space-y-3">
            <div className="flex flex-col gap-3 rounded-lg border bg-white p-3 sm:flex-row sm:items-center">
              <AttachmentIcon isPdf={isPdf} />
              <div className="min-w-0 flex-1">
                <p className="break-all font-medium" title={attachmentName}>
                  {attachmentName}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {recruitment ? '点击下方按钮下载或预览简历 PDF' : '点击下方按钮下载或预览'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                onClick={() => onDownloadAttachment(notification.attachment_file!, attachmentName)}
                className="w-full bg-green-500 hover:bg-green-600"
              >
                <Download className="mr-2 h-4 w-4" />
                下载附件
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(notification.attachment_file!, '_blank')}
                className="w-full"
              >
                <Eye className="mr-2 h-4 w-4" />
                在线预览
              </Button>
            </div>
          </div>
        </div>
      )}

      {notification.email_sent === 1 && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <Mail className="h-4 w-4" />
          邮件已发送
        </div>
      )}
      {notification.email_error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">
          {recruitment ? <MailX className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span className="break-words">邮件发送失败: {notification.email_error}</span>
        </div>
      )}
    </>
  );
}
