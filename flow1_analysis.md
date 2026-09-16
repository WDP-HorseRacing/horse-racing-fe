# Flow 1 — Quản lý Hồ sơ & Lý lịch Ngựa (Chi tiết Endpoint + Nghiệp vụ)

> File này phân tích toàn bộ Flow 1 dựa trên: đề bài (Racehorse_Training_System.docx), BE source code hiện tại (nhánh dev), và logic Web UI đã triển khai. Dùng file này để tạo checklist Excel cho demo và phân công task. LƯU Ý: Các payload JSON ở đây là BẢN CHUẨN ĐẦY ĐỦ (đã bao gồm các field đề xuất thêm trong file be_schema_proposal.md) để DB lưu trữ không bị lỗi.

---

## Tổng quan Flow 1
Flow 1 là nền tảng của toàn bộ hệ thống: mọi luồng khác (Huấn luyện, Y tế, Chăm sóc, Thi đấu) đều phụ thuộc vào hồ sơ ngựa được tạo ở đây.

**Actor chính:** Club Manager (tạo/sửa/xóa hồ sơ)
**Actor phụ:** Horse Owner (cung cấp thông tin, xem), Head Trainer (xem sau khi tạo)
**Các Use Case liên quan:** UC-F1-01 (Tạo hồ sơ), UC-19 (Xem lý lịch/phả hệ), UC-20 (Xem sức khỏe)

---

## Endpoint 1: Lấy danh sách ngựa

### GET /horses
- **Ai được gọi:** HEAD_TRAINER, VETERINARIAN, GROOM, HORSE_OWNER, CLUB_MANAGER (tất cả đều xem được, nhưng Owner chỉ thấy ngựa mình sở hữu)
- **Query Params:**
  - limit (number) — giới hạn số lượng trả về
  - healthStatus (string, optional) — lọc theo ELIGIBLE / UNDER_OBSERVATION / INJURED / QUARANTINED
  - lifecycleStatus (string, optional) — lọc theo ACTIVE / RETIRED / TRANSFERRED
- **Response:** Mảng các object Horse (id, name, breed, healthStatus, lifecycleStatus, photoUrl, ...)
- **Nghiệp vụ:**
  - Mặc định chỉ trả ngựa có lifecycle_status = ACTIVE (ngựa đã nghỉ hưu hoặc chuyển nhượng không hiển thị, trừ khi filter rõ)
  - Phải filter theo club_id của user đang đăng nhập (mỗi CLB chỉ thấy ngựa của CLB mình)
  - Nếu user là HORSE_OWNER, chỉ trả ngựa mà user sở hữu (join bảng horse_ownerships)
- **Trạng thái BE hiện tại:** Controller đã có, logic chưa implement (trả 501)

### GET /owners/me/horses
- **Ai được gọi:** HORSE_OWNER
- **Response:** Danh sách ngựa mà owner hiện tại đang sở hữu
- **Nghiệp vụ:** Lọc qua bảng horse_ownerships WHERE owner_id = currentUser.id AND end_date IS NULL
- **Trạng thái BE:** Controller có, chưa implement

---

## Endpoint 2: Xem chi tiết hồ sơ ngựa

### GET /horses/:id
- **Ai được gọi:** Tất cả actor (nhưng phải cùng CLB hoặc là Owner)
- **Response:** Toàn bộ thông tin 1 con ngựa:
  `json
  {
    "id": "uuid",
    "name": "Thunder King",
    "dateOfBirth": "2022-03-15",
    "gender": "MALE",
    "breed": "Thoroughbred",
    "color": "Bay",
    "microchipId": "985121028743210",
    "raceAptitude": "SPRINTER",
    "currentWeightKg": 512,
    "healthStatus": "ELIGIBLE",
    "lifecycleStatus": "ACTIVE",
    "trainingLock": false,
    "photoUrl": "https://...",
    "sireId": "uuid-of-father",
    "damId": "uuid-of-mother",
    "primaryOwner": {
      "id": "uuid",
      "name": "Sheikh Mohammed",
      "percentage": 60
    },
    "createdAt": "2025-01-10T10:00:00Z"
  }
  `
- **Nghiệp vụ:**
  - 	rainingLock là field ảo (virtual): kiểm tra bảng 	raining_locks xem có record nào status = ACTIVE cho ngựa này không.
  - **Logic Chủ Sở Hữu (Owner):** Trả về primaryOwner (người giữ phần trăm cao nhất) để Frontend hiển thị tóm tắt ngay trên giao diện mà không làm rối mắt. Sẽ có nút "Xem tất cả chủ sở hữu" gọi tới API GET /horses/:horseId/owners để xem danh sách chi tiết (Syndicate).
  - Nếu lifecycle_status = RETIRED, vẫn cho xem nhưng không cho tạo giáo án (BR-04).
  - HORSE_OWNER cố truy cập ngựa không thuộc sở hữu → trả 403 Forbidden + ghi audit log truy cập bất thường.
- **Trạng thái BE:** Controller có, chưa implement

---

## Endpoint 3: Tạo hồ sơ ngựa mới

### POST /horses
- **Ai được gọi:** CHỈ CLUB_MANAGER
- **Request Body:**
  `json
  {
    "name": "Thunder King",
    "dateOfBirth": "2022-03-15",
    "gender": "MALE",
    "breed": "Thoroughbred",
    "color": "Bay",
    "microchipId": "985121028743210",
    "raceAptitude": "SPRINTER",
    "sireId": "uuid-of-father (optional)",
    "damId": "uuid-of-mother (optional)",
    "mediaId": "uuid-of-photo (optional)"
  }
  `
- **Nghiệp vụ (Business Rules):**
  - **BR-01:** Kiểm tra trùng lặp: 
ame + dateOfBirth + microchipId không được trùng trong cùng CLB. Nếu trùng → trả lỗi 409 Conflict
  - **BR-03:** Chỉ CLUB_MANAGER mới có quyền tạo. HEAD_TRAINER hay GROOM gọi API này → trả 403
  - Tự động gán health_status = ELIGIBLE và lifecycle_status = ACTIVE
  - Tự động 	raining_lock = false
  - Nếu sireId hoặc damId được cung cấp, kiểm tra tồn tại trong DB
  - aceAptitude có thể null (chưa xác định) — không bắt buộc nhập ngay
  - Ghi **Audit Log**: action = CREATE, entity_type = HORSE, entity_id = id mới, actor_id = manager
  - Gửi **Notification** cho Horse Owner (nếu sẽ gán ownership ngay sau đó)
- **Trạng thái BE hiện tại:**
  - Controller có endpoint POST. Cần đảm bảo BE implement đủ các field đề xuất trong e_schema_proposal.md để khớp payload này.

---

## Endpoint 4: Cập nhật hồ sơ ngựa

### PATCH /horses/:id
- **Ai được gọi:** CLUB_MANAGER (toàn quyền), HEAD_TRAINER (chỉ sửa raceAptitude + weight), VETERINARIAN (chỉ sửa healthStatus)
- **Request Body:** Partial của payload tạo mới (chỉ gửi field cần sửa)
- **Nghiệp vụ:**
  - **BR-03:** Phân quyền theo field:
    - CLUB_MANAGER: sửa được mọi field (tên, giống, dòng dõi, ...)
    - HEAD_TRAINER: chỉ sửa aceAptitude, currentWeightKg (thuộc chuyên môn huấn luyện)
    - VETERINARIAN: chỉ sửa healthStatus (thuộc chuyên môn y tế)
    - Các actor khác: không được sửa → 403
  - Khi sửa healthStatus từ ELIGIBLE sang INJURED, hệ thống gợi ý Vet tạo luôn Medical Record (liên kết Flow 3)
  - Ghi **Audit Log** với efore_data và fter_data để biết thay đổi gì
- **Trạng thái BE:** Controller có, chưa implement logic phân quyền theo field

---

## Endpoint 5: Xóa mềm hồ sơ ngựa

### DELETE /horses/:id
- **Ai được gọi:** CHỈ CLUB_MANAGER
- **Nghiệp vụ:**
  - Chỉ soft-delete (đặt deleted_at = now()) — không xóa vật lý
  - Không được xóa nếu ngựa đang có TrainingPlan ở trạng thái ACTIVE hoặc SCHEDULED
  - Không được xóa nếu ngựa đang có TrainingLock ACTIVE
  - Ghi Audit Log
- **Trạng thái BE:** Controller có, Entity kế thừa SoftDeletableRecordEntity (đã hỗ trợ soft-delete), chưa implement validation

---

## Endpoint 6: Quản lý quyền sở hữu

### PUT /horses/:id/owners
- **Ai được gọi:** CHỈ CLUB_MANAGER
- **Request Body:**
  `json
  {
    "owners": [
      { "ownerId": "uuid-1", "percentage": 60 },
      { "ownerId": "uuid-2", "percentage": 40 }
    ]
  }
  `
- **Nghiệp vụ:**
  - **BR-02:** Tổng percentage phải = 100%. Nếu khác → trả 400 Bad Request
  - Mỗi ownerId phải là 1 user hợp lệ trong hệ thống (Cho phép mọi User đứng tên, bao gồm cả CLUB_MANAGER tự mua ngựa).
  - Khi thay đổi ownership: đóng record cũ (set end_date = today), tạo record mới (set start_date = today)
  - Gửi Notification cho Owner mới được thêm vào
- **Trạng thái BE:** Controller có, DTO SetHorseOwnersDto có, chưa implement

### GET /horses/:horseId/owners
- **Ai được gọi:** Tất cả actor cùng CLB
- **Response:** Lịch sử sở hữu (bao gồm cả ownership đã kết thúc — có endDate)
- **Trạng thái BE:** Controller có, chưa implement

---

## Endpoint 7: Xem phả hệ (Pedigree)

### GET /horses/:horseId/pedigree
- **Ai được gọi:** Tất cả actor
- **Response:** Cây phả hệ tối thiểu 2 đời:
  `json
  {
    "horse": { "id": "...", "name": "Thunder King", "raceAptitude": "SPRINTER" },
    "sire": {
      "id": "...", "name": "Storm Cat", "raceAptitude": "SPRINTER",
      "sire": { "name": "Storm Bird" },
      "dam": { "name": "Terlingua" }
    },
    "dam": {
      "id": "...", "name": "Island Kitty", "raceAptitude": "MILER",
      "sire": { "name": "Hawaii" },
      "dam": { "name": "T.C. Kitten" }
    }
  }
  `
- **Nghiệp vụ:**
  - Recursive query: horse → sire → sire.sire / sire.dam (tối đa 2 đời để không quá nặng)
  - Nếu sire/dam không có trong hệ thống → trả null cho node đó
  - Đây là điểm demo quan trọng: cho thấy aceAptitude được "truyền" qua phả hệ (cha SPRINTER + mẹ SPRINTER → con SPRINTER)
- **Trạng thái BE:** Controller có, chưa implement

---

## Endpoint 8: Kiểm tra điều kiện huấn luyện/thi đấu

### GET /horses/:horseId/eligibility
- **Ai được gọi:** HEAD_TRAINER, CLUB_MANAGER
- **Response:**
  `json
  {
    "canTrain": true,
    "canRace": true,
    "trainingLock": null,
    "healthStatus": "ELIGIBLE",
    "lifecycleStatus": "ACTIVE",
    "warnings": []
  }
  `
  Hoặc khi bị khóa:
  `json
  {
    "canTrain": false,
    "canRace": false,
    "trainingLock": {
      "reason": "Left front tendon strain",
      "lockedBy": "Dr. Nguyen",
      "lockStart": "2025-09-10",
      "lockEnd": null
    },
    "healthStatus": "INJURED",
    "warnings": ["Training locked by Veterinarian"]
  }
  `
- **Nghiệp vụ:**
  - **BR-04:** Nếu lifecycle_status = RETIRED hoặc TRANSFERRED → canTrain = false, canRace = false
  - **BR-05:** Nếu health_status = INJURED hoặc QUARANTINED → canTrain = false
  - **BR-09/BR-12:** Nếu có TrainingLock ACTIVE → canTrain = false, canRace = false
  - Endpoint này tập trung toàn bộ logic kiểm tra điều kiện vào 1 chỗ, các luồng khác (Flow 2, Flow 5) chỉ cần gọi endpoint này thay vì tự kiểm tra
- **Trạng thái BE:** Controller có, chưa implement

---

## Endpoint 9: Cập nhật trạng thái ngựa

### PATCH /horses/:horseId/status
- **Ai được gọi:** VETERINARIAN (sửa healthStatus), CLUB_MANAGER (sửa lifecycleStatus)
- **Request Body:**
  `json
  {
    "healthStatus": "INJURED",
    "reason": "Left hind leg swelling observed"
  }
  `
- **Nghiệp vụ:**
  - Khi chuyển sang INJURED: hệ thống gợi ý Vet tạo Medical Record ngay (liên kết Flow 3)
  - Khi chuyển từ INJURED về ELIGIBLE: kiểm tra không còn TrainingLock ACTIVE nào
  - Ghi Audit Log với before/after status
  - Gửi Notification cho HEAD_TRAINER và HORSE_OWNER khi status thay đổi
- **Trạng thái BE:** Controller có, DTO UpdateHorseStatusDto có, chưa implement

---

## Tổng hợp Business Rules liên quan Flow 1

| Mã | Nội dung | Kiểm tra ở endpoint nào |
|---|---|---|
| BR-01 | name + dateOfBirth + microchipId không trùng trong cùng CLB | POST /horses |
| BR-02 | Tổng % sở hữu = 100% | PUT /horses/:id/owners |
| BR-03 | Chỉ CLUB_MANAGER tạo/xóa hồ sơ; actor khác chỉ sửa field chuyên môn | POST, PATCH, DELETE /horses |
| BR-04 | Ngựa RETIRED/TRANSFERRED không xuất hiện khi lập giáo án | GET /horses (filter), GET /horses/:id/eligibility |
| BR-05 | Không tạo giáo án cho ngựa INJURED/QUARANTINED/LOCKED | GET /horses/:id/eligibility |
| BR-09 | Chỉ VET tạo/gỡ TrainingLock | PATCH /horses/:id/status (liên kết Flow 3) |
| BR-12 | Ngựa bị lock hoặc health ≠ ELIGIBLE → không đăng ký đua | GET /horses/:id/eligibility |
| BR-14 | Mọi thao tác CUD trên hồ sơ ngựa → ghi Audit Log | Tất cả endpoint POST/PATCH/DELETE |