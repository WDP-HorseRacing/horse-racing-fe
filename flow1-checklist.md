Flow 1 Checklist - Horse Profile & History 
Flow 1: Quản lý Hồ sơ & Lý lịch Ngựa 
 Artifact checklist cho phạm vi nghiệp vụ, quyền truy cập, endpoint,
 business rule và tiêu chí nghiệm thu của Horse Profile & History
 Management.
 5 actor chính 
 12 nhóm chức năng 
 14 business rules 
 4 nhóm cross-cutting 
Mục tiêu Flow 1 
 Quản lý vòng đời hồ sơ ngựa từ lúc tạo mới, cập nhật, ownership, phả
 hệ, sức khỏe, điều kiện tập luyện/thi đấu đến lịch sử thành tích và
 chỉ số thể lực.
 Nguyên tắc dữ liệu: mọi truy vấn nghiệp vụ phải giới
 hạn theo club_id ; ownership, weight, medical record,
 training lock và race history là dữ liệu lịch sử, không ghi đè thành
 một giá trị duy nhất.
Mục lục 
 Actor & quyền 
 Hồ sơ ngựa 
 Ownership 
 Pedigree 
 Sức khỏe 
 Eligibility 
 Performance 
 Race history 
 Audit & notification 
 Acceptance checklist 
 Source status 
1. Actor và quyền 
 Actor 
 View 
 Record / Update 
 Không được phép 
 Club Manager 
 Toàn bộ ngựa trong club 
 Create, update toàn bộ profile, delete mềm, ownership, lifecycle
 status
 Không truy cập dữ liệu club khác 
 Head Trainer 
 Profile, pedigree, eligibility, performance 
 Performance/training; chỉ sửa aptitude và weight nếu được cấp
 Không create/delete profile; không ghi medical diagnosis 
 Veterinarian 
 Profile, health, medical history 
 Medical record, diagnosis, injury, prescription, training lock,
 health status
 Không sửa ownership/lifecycle/profile thương mại 
 Groom / Stable Hand 
 Thông tin cần cho chăm sóc và stable 
 Care checklist, incident theo scope được cấp 
 Không xem/sửa ownership, diagnosis hoặc performance nhạy cảm
 Horse Owner 
 Chỉ ngựa đang sở hữu: profile, pedigree, health summary, race
 history
 Không tự sửa hồ sơ; có thể approve workflow race nếu flow đó
 được bật
 Không xem ngựa owner khác trong cùng club 
 Lưu ý: role trong JWT chỉ quyết định nhóm quyền. Với
 HORSE_OWNER , service vẫn phải kiểm tra bảng
 horse_ownerships để xác nhận quyền trên từng horse.
2. Quản lý hồ sơ ngựa 
 Endpoint / chức năng 
 Actor 
 Nghiệp vụ bắt buộc 
 Done 
 GET /horses 
 Manager, Trainer, Vet, Groom, Owner 
 Pagination; filter health/lifecycle; mặc định ACTIVE; club
 isolation; Owner chỉ thấy horse mình sở hữu
 PARTIAL 
 GET /horses/:id 
 Actor có quyền view 
 Profile đầy đủ, current weight, photo URL, primary owner,
 training lock summary, createdAt
 PARTIAL 
 POST /horses 
 Club Manager 
 Validate required fields; default ACTIVE/ELIGIBLE; validate
 parents cùng club; duplicate check; audit
 PARTIAL 
 PATCH /horses/:id 
 Manager; field scope cho Trainer/Vet 
 Field-level authorization; validate changed fields; before/after
 audit
 TODO 
 DELETE /horses/:id 
 Club Manager 
 Soft delete; chặn nếu active/scheduled training plan hoặc active
 lock; audit
 PARTIAL 
Profile fields 
 name , dateOfBirth , gender ,
 breed , color 
 microchipId , mediaId/photoUrl ,
 raceAptitude 
 healthStatus , lifecycleStatus , latest
 weight
Sire/dam relation và primary owner projection 
3. Quản lý ownership 
 Endpoint 
 Actor 
 Nghiệp vụ 
 Done 
 GET /owners/me/horses 
 Horse Owner 
 owner_id = currentUser.id và
 end_date IS NULL 
 PARTIAL 
 GET /horses/:horseId/owners 
 Cùng club; Owner phải sở hữu horse 
 Trả current và historical ownership 
 DONE 
 PUT /horses/:id/owners 
 Club Manager 
 Tổng percentage = 100; owner hợp lệ cùng club; đóng record cũ;
 tạo record mới; audit/notification
 PARTIAL 
 BR-02: không cho duplicate owner trong cùng request
 và không cho tổng tỷ lệ khác 100%.
4. Pedigree nhiều đời 
 Endpoint 
 Response option 
 Nghiệp vụ 
 Done 
 GET /horses/:id/pedigree?depth=1 
 Cha/mẹ trực tiếp 
 Parent cùng club, node null nếu chưa có dữ liệu 
 PARTIAL 
 GET /horses/:id/pedigree?depth=2 
 Hai đời 
 Recursive CTE, không eager-load vô hạn 
 DONE 
 GET /horses/:id/pedigree?depth=1..4 
 Tối đa bốn đời 
 Validate depth, detect cycle, không có all 
 DONE 
 Schema chuẩn: horses.sire_id và
 horses.dam_id là source of truth.
Recursive CTE giới hạn depth tối đa 4 đời. 
Constraint chống self-parent và duplicate SIRE/DAM. 
 Transaction cập nhật hai cột parent, không rebuild bảng dẫn xuất.
 Không suy ra aptitude tự động nếu chưa có rule nghiệp vụ được duyệt.
5. Sức khỏe và y tế 
 Chức năng 
 Actor 
 Nghiệp vụ 
 Done 
 Health status 
 Vet record; Manager quản lý lifecycle 
 ELIGIBLE, UNDER_OBSERVATION, INJURED, QUARANTINED 
 PARTIAL 
 GET /horses/:id/medical-records 
 Vet, Trainer, Manager; Owner theo policy 
 Diagnosis, severity, resulting status, prescriptions 
 DONE 
 GET /horses/:id/injuries 
 Vet, Trainer, Manager 
 Timeline injury và recovery status 
 DONE 
 Training lock 
 Veterinarian 
 Create, list, update, release; chỉ một lock ACTIVE/horse 
 TODO 
 Medical write workflow 
 Veterinarian 
 Create record, prescription, injury marker, void record 
 TODO 
6. Eligibility huấn luyện và thi đấu 
 Rule 
 Điều kiện 
 Kết quả 
 BR-04 
 lifecycleStatus = RETIRED/TRANSFERRED 
 canTrain = false , canRace = false 
 BR-05 
 healthStatus = INJURED/QUARANTINED 
 Không được train; racing bị khóa theo policy 
 BR-09 
 Có training_lock.status = ACTIVE 
 Không train/race; trả lock detail 
 BR-12 
 Health không ELIGIBLE hoặc đang lock 
 Không được đăng ký race 
 Response chuẩn đề xuất: canTrain , canRace ,
 trainingLock , healthStatus ,
 lifecycleStatus , warnings[] .
7. Performance và thể lực 
Head Trainer xem performance summary của từng horse. 
Hiển thị metric gần nhất: heart rate, speed, alert level. 
Hiển thị lịch sử metric để vẽ chart theo thời gian. 
Hiển thị evaluation gần nhất và score/comment. 
Cho phép filter theo khoảng thời gian khi UI cần. 
Không cho role không phù hợp ghi performance evaluation. 
 PARTIAL Source đã có summary read,
 nhưng chưa có đủ workflow record và dashboard filter.
8. Race history và aptitude warning 
Horse Owner chỉ xem race history của horse đang sở hữu. 
 Race history trả race, scheduled time, status, registration status,
 placing, time.
 So sánh raceAptitude với distanceMeters .
Hiển thị warning trước khi registration được confirm. 
Cho phép Head Trainer bỏ qua warning có chủ đích. 
 Lưu aptitudeWarningIgnored , người bỏ qua và thời điểm.
Ghi audit khi warning bị bỏ qua. 
 Không lưu cứng kết quả warning lâu dài vì race distance hoặc aptitude
 có thể thay đổi. Warning nên được tính lại trong racing service.
9. Cross-cutting nghiệp vụ 
 Nhóm 
 Checklist 
 Rule 
 Tenant isolation 
 Horse, owner, parent, medical, race và performance đều cùng club
 Không tin clubId từ request 
 Audit 
 Create, update, delete, ownership, status, lock, override 
 BR-14; lưu actor, before/after, correlation ID 
 Notification 
 Status, ownership, lock, race approval/override 
 Không gửi trước khi transaction commit 
 Validation 
 UUID, enum, percentage, parent relation, duplicate, date range
 Lỗi domain rõ ràng: 400/403/404/409 
 Testing 
 RBAC, owner isolation, cycle, eligibility, ownership transaction
 Không chỉ dựa vào typecheck/build 
10. Acceptance checklist 
Profile lifecycle 
Manager tạo được horse với profile fields đầy đủ. 
Duplicate profile trả 409. 
Manager update/delete được horse trong club. 
Delete bị chặn khi training plan/lock đang active. 
Trainer/Vet chỉ update đúng field chuyên môn. 
Ownership & access 
Ownership total luôn bằng 100%. 
Owner không xem được horse không thuộc mình. 
Ownership history giữ được record đã kết thúc. 
Mọi thay đổi ownership có audit và notification. 
Pedigree 
Depth 1, depth N và all trả đúng cấu trúc. 
Không query vượt max depth/max nodes. 
Cycle bị từ chối khi ghi hoặc được phát hiện khi đọc. 
Ancestor khác club bị từ chối. 
Health, eligibility & racing 
Active training lock khóa train/race. 
Eligibility trả lock detail và warning. 
Health/lifecycle status enforce đúng role. 
Aptitude warning hiển thị trước race registration. 
Override aptitude warning có actor/time/audit. 
11. Trạng thái source hiện tại 
 Nhóm 
 Trạng thái 
 Ghi chú 
 Horse CRUD 
 PARTIAL 
 Happy path có; field-level authorization và business guard còn
 thiếu.
 Ownership 
 PARTIAL 
 Query/replace có; audit/notification/concurrency hardening còn
 thiếu.
 Pedigree 
 PARTIAL 
 Parent relation migration, recursive CTE API và cycle validation
 đã có; focused tests còn thiếu.
 Medical read 
 PARTIAL 
 Records, prescriptions, injuries read có; write/lock workflow
 còn pending.
 Eligibility 
 PARTIAL 
 Health/lifecycle cơ bản có; active lock/warnings chưa nối.
 Performance 
 PARTIAL 
 Summary read có; recording/dashboard đầy đủ chưa có. 
 Audit/notification 
 TODO 
 Entity/table có nhưng horse workflows chưa ghi dữ liệu. 
 Tests 
 TODO 
 Chưa có focused tests cho Flow 1. 
 Flow 1 working artifact. Cập nhật checklist sau mỗi migration hoặc thay
 đổi business rule.