export type DormitoryStatus = '待审核' | '已审核' | '已入住' | '已退宿';

export interface DormitoryApplicationData {
  name: string;
  phone: string;
  department: string;
  position: string;
  idCard: string;
  expectedCheckInDate: string;
  reason: string;
  agreedToRules: boolean;
  submittedDate: string;
}

export interface DormitoryRecord {
  id: number;
  status: DormitoryStatus;
  data: DormitoryApplicationData;
  name: string;
  phone: string;
  department: string;
  position: string;
  idCard: string;
  expectedCheckInDate: string;
  reason: string;
  reviewerName: string | null;
  reviewOpinion: string | null;
  reviewedAt: string | null;
  roomNo: string | null;
  bedNo: string | null;
  roomBed: string | null;
  keyIssued: string | null;
  handlerName: string | null;
  checkedInAt: string | null;
  checkoutApplyDate: string | null;
  moveOutDate: string | null;
  checkoutReason: string | null;
  keyReturned: string | null;
  checkoutHandlerName: string | null;
  checkedOutAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface DormitoryRoom {
  id: number;
  roomNo: string;
  capacity: number;
  remark: string | null;
  bedCount: number;
  occupiedCount: number;
  isFull: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface DormitoryBed {
  id: number;
  roomId: number;
  roomNo: string;
  bedNo: string;
  occupiedRecordId: number | null;
  occupiedByName: string | null;
  createdAt: string;
}

export interface DormitoryRoomResident {
  id: number;
  name: string;
  phone: string | null;
  department: string | null;
  position: string | null;
  bedNo: string | null;
  roomBed: string | null;
  keyIssued: string | null;
  handlerName: string | null;
  checkedInAt: string | null;
}
