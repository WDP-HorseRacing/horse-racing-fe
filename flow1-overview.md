Flow 1 - Horse Profile & History 
Flow 1: Horse Profile & History 
 Tài liệu nghiệp vụ mô tả cách một hồ sơ ngựa được tạo, quản lý, truy
 xuất và dùng làm nền cho y tế, huấn luyện và thi đấu.
Flow 1 là gì? 
 Flow 1 là nguồn dữ liệu trung tâm của hệ thống. Một horse profile
 không chỉ là tên và ảnh; nó là điểm nối giữa club, ownership,
 pedigree, sức khỏe, training, performance và race history.
 Mọi thao tác phải trả lời được ba câu hỏi:
 ai đang truy cập ,
 ngựa thuộc club nào và
 trạng thái hiện tại cho phép nghiệp vụ gì .
Mục lục 
 Actors 
 Luồng tổng quát 
 Tạo hồ sơ 
 Quản lý hồ sơ 
 Ownership 
 Pedigree 
 Sức khỏe 
 Eligibility 
 Performance 
 Race history 
 Ranh giới với flow khác 
 Invariant 
1. Actors trong Flow 1 
 Club Manager Create, update, soft delete, ownership và lifecycle. 
 Head Trainer Xem profile, pedigree, performance; record chuyên môn
 training. 
 Veterinarian Xem sức khỏe; record diagnosis, treatment, injury và lock. 
 Groom Xem thông tin cần cho stable và chăm sóc hằng ngày. 
 Horse Owner Chỉ xem các horse đang sở hữu, pedigree và thành tích. 
 Authorization hai lớp: RBAC kiểm tra vai trò; domain
 service kiểm tra ownership/club trước khi trả dữ liệu horse cụ thể.
2. Luồng tổng quát 
 1 Register Manager tạo hồ sơ và
 validate profile/parent.
 2 Identify Gắn photo, microchip,
 gender, breed, color và aptitude.
 3 Own Gán owner shares, lưu lịch sử
 và thông báo.
 4 Operate Training, medical,
 weight, performance và care dùng profile.
 5 Race Eligibility và aptitude
 warning quyết định có thể thi đấu.
 Hồ sơ có thể được xem sau khi tạo, kể cả khi horse đã
 RETIRED hoặc
 TRANSFERRED ; các trạng thái đó chỉ
 chặn nghiệp vụ phù hợp, không xóa lịch sử.
3. Tạo hồ sơ ngựa 
Request 
 POST /api/v1/horses 
 Profile gồm name, dateOfBirth, gender, breed, color, microchipId,
 raceAptitude, sireId, damId và mediaId.
Validation 
Chỉ CLUB_MANAGER . 
 Kiểm tra duplicate profile, parent tồn tại/cùng club, parent không
 phải chính horse, enum và format.
Commit 
 Ghi horse với mặc định ACTIVE và
 ELIGIBLE .
 Ghi audit sau commit. Nếu ownership được gán ngay, phát
 notification sau transaction.
4. Quản lý hồ sơ 
 Action 
 Route 
 Quyền 
 Kiểm soát 
 List 
 GET /horses 
 View theo role 
 Club scope, filter health/lifecycle, Owner scope. 
 Detail 
 GET /horses/:id 
 View theo role 
 Profile projection, weight mới nhất, primary owner, lock
 summary.
 Update 
 PATCH /horses/:id 
 Field-level role 
 Manager toàn quyền; Trainer/Vet chỉ field chuyên môn. 
 Delete 
 DELETE /horses/:id 
 Manager 
 Soft delete; chặn active plan/lock; audit. 
 Không dùng role để suy ra ownership: một user có role
 HORSE_OWNER không đồng nghĩa user đó sở hữu mọi horse.
5. Ownership và lịch sử sở hữu 
 Ownership được lưu theo thời gian trong horse_ownerships .
 Record đang hoạt động có end_date IS NULL ; khi thay đổi,
 record cũ được đóng và record mới bắt đầu trong cùng transaction.
 Route 
 Mục đích 
 Kết quả nghiệp vụ 
 PUT /horses/:id/owners 
 Thay ownership hiện tại 
 Tổng percentage phải bằng 100%; owner phải thuộc club. 
 GET /horses/:horseId/owners 
 Xem history 
 Trả cả current và ended ownership, dùng cho audit/lý lịch.
 GET /owners/me/horses 
 Owner xem horse của mình 
 Chỉ current ownership của current user. 
6. Pedigree nhiều đời 
 Pedigree dùng horses.sire_id và
 horses.dam_id làm source of truth. API đọc bằng
 PostgreSQL recursive CTE, tối đa bốn đời.
 Option 
 Ý nghĩa 
 Guard 
 depth=1 
 Cha/mẹ trực tiếp 
 Response nhỏ, dùng cho summary. 
 depth=1..4 
 Tối đa bốn đời 
 Depth phải là số nguyên từ 1 đến 4. 
 Nguyên tắc: không suy ra race aptitude từ pedigree
 một cách tự động nếu chưa có rule được phê duyệt. Pedigree chỉ cung
 cấp dữ liệu đầu vào cho việc đánh giá.
7. Sức khỏe và medical history 
 Veterinarian là actor ghi nhận sự kiện y tế. Hồ sơ y tế là
 append-only; nếu cần sửa, tạo record thay thế hoặc void có lý do,
 không âm thầm overwrite record cũ.
 Dữ liệu 
 Bảng 
 Ý nghĩa 
 Health status 
 horses.health_status 
 Snapshot trạng thái hiện tại để filter nhanh. 
 Medical examination 
 medical_records 
 Diagnosis, severity, resulting status và vet. 
 Treatment 
 prescriptions 
 Medicine, dosage, frequency, thời hạn. 
 Injury 
 injury_markers 
 Vị trí, loại injury và recovery status. 
 Training lock 
 training_locks 
 Khóa train/race có thời điểm và người khóa/release. 
8. Eligibility trung tâm 
 GET /horses/:horseId/eligibility là facade để Flow
 Training và Flow Racing không tự lặp business rule.
 Điều kiện 
 canTrain 
 canRace 
 Warning 
 Lifecycle RETIRED/TRANSFERRED 
 false 
 false 
 Lifecycle không active 
 Health INJURED/QUARANTINED 
 false 
 false hoặc theo policy 
 Health status cần xử lý 
 Training lock ACTIVE 
 false 
 false 
 Trả lock reason, vet và thời gian 
 ACTIVE + ELIGIBLE + không lock 
 true 
 true 
 Không có warning 
9. Performance và thể lực 
 Performance không sửa horse profile trực tiếp. Nó tạo chuỗi quan sát
 theo training session để Head Trainer xem xu hướng.
 performance_metrics : heart rate, speed, alert level
 theo thời gian.
 performance_evaluations : score và comment của người
 đánh giá.
 performance_thresholds : ngưỡng theo club hoặc horse, có
 version/effective date.
 API summary nên trả dữ liệu chart-ready và filter theo khoảng thời
 gian.
10. Race history và aptitude warning 
 Race history lấy từ race_registrations kết hợp
 races . Aptitude warning được tính lúc đăng ký dựa trên
 race_aptitude và distance_meters .
Load horse aptitude và race distance. 
Đánh giá rule SPRINTER/MILER/STAYER. 
 Nếu không phù hợp, trả warning trước khi confirm registration.
 Nếu trainer bỏ qua, lưu actor/time vào registration và audit log.
 Không lưu warning result cứng vì aptitude hoặc race distance có thể
 thay đổi.
11. Ranh giới với flow khác 
 Flow khác 
 Flow 1 cung cấp 
 Flow khác chịu trách nhiệm 
 Training 
 Horse profile, lifecycle, eligibility, active lock 
 Plan, session, evaluation và completion. 
 Medical 
 Current health snapshot, medical history entry point 
 Diagnosis, prescription, injury và lock lifecycle. 
 Racing 
 Eligibility, aptitude, race history 
 Race event, registration approval, result. 
 Stable/Care 
 Horse identity, current weight, status 
 Stall, feeding, checklist và care schedule. 
 Audit/Notification 
 Domain event sau mutation 
 Persist audit và deliver notification. 
12. Invariant phải luôn đúng 
 Horse và các bản ghi con được truy cập trong cùng
 club_id .
 Ownership hiện tại của một horse có tổng percentage bằng 100%.
Không có horse làm parent của chính nó hoặc tạo cycle. 
Chỉ có một training lock ACTIVE trên một horse. 
Horse bị lock hoặc không eligible không được train/race. 
Mọi mutation nhạy cảm có actor, transaction và audit. 
History không bị xóa hoặc overwrite khi tạo trạng thái mới. 
 Definition of Done: Flow 1 chỉ được xem là hoàn tất
 khi endpoint happy path, RBAC, tenant isolation, business validation,
 audit/notification và focused tests đều pass.
 Flow 1 business overview. Checklist triển khai chi tiết nằm tại
 docs/flow1-checklist.html .