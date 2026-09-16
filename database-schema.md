Racehorse Database Schema 
Racehorse Database Schema 
 Tài liệu baseline cho backend horse-racing-ne: bảng, khóa, quan hệ, các
 điểm hỗ trợ pedigree tùy chọn độ sâu và aptitude warning.
 29 bảng theo entity/migration hiện tại
 UUID primary key cho các bảng nghiệp vụ
 TypeORM synchronize tắt, migration là nguồn thay đổi
 DB
Kết luận thiết kế 
 Pedigree: dùng hai cột horses.sire_id và
 horses.dam_id làm quan hệ cha/mẹ trực tiếp. API dùng
 PostgreSQL recursive CTE để query tối đa bốn đời mà không cần bảng dẫn
 xuất.
 Giới hạn: DB đã có self-parent constraint và
 generation guard, nhưng service vẫn phải giới hạn depth/node, phát
 hiện cycle khi ghi và chỉ query ancestor cùng club.
 Aptitude warning: DB đã có
 horses.race_aptitude ,
 races.distance_meters và cờ override trên
 race_registrations . DB lưu được dữ liệu, nhưng logic cảnh
 báo vẫn phải nằm ở service. Nên cấu hình rule ở code trước; khi rule
 cần thay đổi theo club/version thì thêm bảng policy sau.
Mục lục bảng 
 Identity & media 
 Horses & ownership 
 Training & performance 
 Stable & operations 
 Racing 
 Medical 
 Supporting 
 Key strategy 
 Mismatches & next work 
1. Identity & media 
 Table 
 Primary key 
 Foreign keys 
 Pedigree API: 
 recursive CTE traversal có maximum node/depth guard, cycle
 validation on writes, same-club validation và response shaping.
 Không dùng unlimited eager relations.
 clubs 
 id 
 None 
 Active name unique 
 Tenant/club boundary. 
 users 
 id 
 club_id -> clubs.id 
 Active Keycloak ID unique; email unique per club; pending email
 unique
 Application user, role and status. 
 media_assets 
 id 
 club_id -> clubs.id ;
 uploaded_by -> users.id 
 Provider/object key unique 
 Private S3/MinIO object metadata. 
2. Horses & ownership 
 Table 
 Primary key 
 Foreign keys 
 Important constraints/indexes 
 Purpose 
 horses 
 id 
 club_id -> clubs.id ;
 photo_asset_id -> media_assets.id ;
 sire_id -> horses.id ;
 dam_id -> horses.id 
 Club/status index; active microchip unique per club 
 Horse profile, lifecycle, health and pedigree links. 
 horse_weight_records 
 id 
 horse_id -> horses.id ;
 measured_by -> users.id 
 (horse_id, measured_at) 
 Historical weight measurements; latest row is current weight.
 horse_ownerships 
 id 
 horse_id -> horses.id ;
 owner_id -> users.id 
 Horse/end-date and owner/end-date indexes 
 Ownership history and current syndicate shares. 
 Pedigree relation: one horse has optional
 sire and dam ; each parent is another row in
 horses . This is an adjacency-list model.
3. Training & performance 
 Table 
 Primary key 
 Foreign keys 
 Important constraints/indexes 
 Purpose 
 training_plans 
 id 
 horse_id -> horses.id ;
 created_by -> users.id 
 Horse/date index 
 Long-running training plan. 
 training_sessions 
 id 
 plan_id -> training_plans.id ;
 groom_id -> users.id 
 Plan/schedule and groom/schedule indexes 
 Concrete training session. 
 time_trials 
 id 
 session_id -> training_sessions.id ;
 video_asset_id -> media_assets.id 
 Session index 
 Timed performance trial. 
 performance_metrics 
 id 
 session_id -> training_sessions.id 
 Unique session/time/source 
 Heart rate, speed and alert stream. 
 performance_evaluations 
 id 
 session_id -> training_sessions.id ;
 evaluator_id -> users.id 
 One evaluation per session 
 Trainer/judge assessment. 
 performance_thresholds 
 id 
 club_id -> clubs.id ; optional
 horse_id -> horses.id 
 Club/horse/effective date index 
 Versioned metric limits. 
4. Stable & operations 
 Table 
 Primary key 
 Foreign keys 
 Important constraints/indexes 
 Purpose 
 stalls 
 id 
 club_id -> clubs.id 
 Active code unique per club 
 Stable stall catalog. 
 stable_assignments 
 id 
 horse_id -> horses.id ;
 stall_id -> stalls.id ;
 groom_id -> users.id 
 One active stall per horse and one active horse per stall 
 Horse-stall-groom assignment history. 
 feeding_plans 
 id 
 horse_id -> horses.id ;
 approved_by -> users.id 
 Horse/effective date index; concentrate check 0..100 
 Versioned nutrition plan. 
 daily_checklists 
 id 
 horse_id -> horses.id ;
 groom_id -> users.id 
 Horse/groom/date unique 
 Daily care checklist. 
 incidents 
 id 
 horse_id -> horses.id ;
 reported_by -> users.id ; optional media
 Horse/created index 
 Stable incident reports. 
 supply_items 
 id 
 club_id -> clubs.id 
 Active item name unique per club 
 Inventory catalog. 
 supply_requests 
 id 
 item_id -> supply_items.id ;
 requested_by -> users.id 
 Item/status index 
 Supply request workflow. 
5. Racing 
 Table 
 Primary key 
 Foreign keys 
 Important constraints/indexes 
 Purpose 
 races 
 id 
 club_id -> clubs.id 
 Club/schedule index; distance_meters supports
 aptitude rules
 Race event and conditions. 
 race_registrations 
 id 
 race_id -> races.id ;
 horse_id -> horses.id ;
 requested_by -> users.id ; optional override user
 Race/horse unique; aptitude override fields 
 Horse entry, approvals and result. 
 Aptitude warning design: calculate warning in a
 racing service from horse aptitude plus race distance. Store only the
 decision to ignore and who ignored it on registration. Do not persist
 a boolean warning result that can become stale when race distance or
 aptitude changes.
6. Medical 
 Table 
 Primary key 
 Foreign keys 
 Important constraints/indexes 
 Purpose 
 training_locks 
 id 
 horse_id -> horses.id ;
 locked_by/released_by -> users.id 
 One active lock per horse 
 Veterinary training/racing lock. 
 medical_records 
 id 
 horse_id -> horses.id ;
 vet_id -> users.id ; optional self replacement
 Horse/exam date index 
 Append-only examination and diagnosis. 
 prescriptions 
 id 
 medical_record_id -> medical_records.id 
 Medical record index 
 Treatment prescription. 
 injury_markers 
 id 
 medical_record_id -> medical_records.id ;
 migration also has injury_case_id 
 Medical record index; injury case/time index 
 Injury location, type and recovery state. 
 care_schedules 
 id 
 horse_id -> horses.id ; optional
 assigned_to -> users.id 
 Horse/due date index 
 Vaccination, deworming and farrier schedule. 
7. Supporting 
 Table 
 Primary key 
 Foreign keys 
 Important constraints/indexes 
 Purpose 
 notifications 
 id 
 recipient_id -> users.id ; optional
 event_id 
 Unique non-null event/recipient 
 In-app notification delivery and read state. 
 audit_logs 
 id 
 club_id -> clubs.id ; optional
 actor_id -> users.id 
 Club/time and entity/time indexes 
 Before/after audit trail for sensitive mutations. 
8. Key strategy 
 Primary key: UUID generated by PostgreSQL
 uuid_generate_v4() .
 Foreign key: relation ownership is explicit;
 destructive behavior is usually RESTRICT , media/parent
 references use SET NULL where appropriate.
 Soft delete: club, user, horse, stall and supply
 item inherit deleted_at ; normal TypeORM queries exclude
 deleted rows.
 Tenant isolation: business queries should resolve
 the caller club and filter through club_id , not trust a
 client-provided club id.
 History: ownership, weight, medical and locks are
 separate records because the current value alone would destroy the
 timeline.
 Migration source of truth: TypeORM
 synchronize is disabled. Entity changes require a
 reviewed migration and pnpm db:migrate .
9. Mismatches and next work 
 Entity/migration drift: clubs has entity
 fields not present in the initial migration;
 media_assets differs in storage key metadata;
 races entity has surface/class/max participants that the
 initial migration lacks; injury_markers migration has
 injury_case_id missing from the entity.
 Pedigree API: recursive CTE traversal có maximum
 node/depth guard, cycle validation on writes, same-club validation và
 response shaping. Không dùng unlimited eager relations.
 API: 
 GET /horses/:horseId/pedigree?depth=2 mặc định, hỗ trợ
 depth=1..4 ; không hỗ trợ truy vấn toàn bộ ancestor để giữ
 giới hạn response và chi phí query rõ ràng.
 Recommended aptitude rule: keep thresholds in a
 versioned application policy first. Later, if each club needs custom
 thresholds, add race_aptitude_rules with
 club_id , aptitude , min/max distance and
 effective dates.
Suggested implementation order 
 Fix remaining entity/migration drift and add schema verification in
 CI.
 Add focused tests for recursive pedigree depth and cycle protection.
Implement aptitude warning in race registration service. 
 Add tests for depth, cross-club parents, cycles and override audit.
 Generated for the horse-racing-ne backend schema review. Migration-managed
 schema; verify against the deployed database before production changes.