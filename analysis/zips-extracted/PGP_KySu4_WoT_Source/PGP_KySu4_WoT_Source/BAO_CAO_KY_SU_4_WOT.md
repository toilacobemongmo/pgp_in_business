# BÁO CÁO KỸ THUẬT — KỸ SƯ 4
## Directed Graph Theory & Web of Trust Path Finding

## 1. Mục tiêu và phạm vi

Kỹ sư 4 phụ trách module `backend/wot-analyzer.js`, mô hình hóa mạng lưới chứng thực OpenPGP thành đồ thị có hướng đa cạnh và cung cấp ba năng lực:

1. Chuẩn hóa chứng thực thành cạnh có trọng số tin cậy.
2. Tìm đường tin cậy tối ưu từ trust anchor đến khóa đích bằng Dijkstra trong không gian chi phí logarit âm, có hop decay `gamma = 0.85`, giới hạn `H <= 4`.
3. Phát hiện điểm thắt cổ chai (Single Point of Failure — SPoF) bằng articulation points trên hình chiếu vô hướng của đồ thị.
4. Tách một số đường tin cậy độc lập theo cạnh và tính dung lượng tin cậy tổng hợp.

Module không ký, giải mã hoặc tự xác minh chữ ký OpenPGP. Nó nhận dữ liệu cạnh đã được parser/chính sách của Kỹ sư 1 kiểm tra và trả về kết quả phân tích cho Kỹ sư 5/API và giao diện trực quan hóa.

## 2. Phân tích đặc tả và giao diện liên kết

### 2.1 Mô hình dữ liệu

- Đỉnh `V`: chuỗi định danh khóa công khai, ví dụ fingerprint v4/v5.
- Cạnh `E`: `{ source, target, certificationType, weight }`.
- Loại chứng thực RFC 4880 được ánh xạ:
  - `0x13`: positive, `1.0`.
  - `0x12`: casual, `0.8`.
  - `0x11`: persona, `0.65`.
  - `0x10`: generic, `0.50`.
- Nhiều cạnh song song có thể được tổng hợp theo `1 - Π(1-w_i)` qua `combineParallelWeights()`.

### 2.2 API nội bộ

- `certificationWeight(type) -> number`: tra trọng số loại chứng thực.
- `combineParallelWeights(weights) -> number`: gộp các chứng thực độc lập.
- `dijkstraTrustPath(edges, source, target, options) -> result|null`.
- `findSecurityBottlenecks(edges) -> string[]`.
- `findIndependentTrustFlow(edges, source, target, options) -> result`.

`result` của đường đi gồm `path`, `hops`, `capacity`, `cost`, `source`, `target`.

### 2.3 Kết nối với bốn kỹ sư còn lại

- Kỹ sư 1 cung cấp packet/signature metadata đã parse, gồm issuer, subject và certification type.
- Kỹ sư 2 bảo vệ Root CA/quorum; fingerprint Root CA hoặc trust anchor được dùng làm `source`.
- Kỹ sư 3 ghi audit log kết quả phân tích, root hash và proof ở tầng ledger.
- Kỹ sư 5 gọi engine trong API verifier/pipeline và sử dụng kết quả để quyết định trust policy trước khi trao đổi dữ liệu.

## 3. Cơ sở lý thuyết

### 3.1 Dijkstra trong không gian logarit âm

Với đường đi `P` có các trọng số `w_i`, năng lực truyền tin cậy là:

`Capacity(P) = Π w_i × gamma^(k-1)`

Do tối đa hóa tích số khó xử lý trực tiếp, biến đổi:

`Cost(P) = -ln(Capacity(P))`

Mỗi cạnh có chi phí không âm nên Dijkstra cho nghiệm tối ưu. Triển khai giới hạn số hop để ngăn chuỗi chứng thực quá dài và làm suy yếu Sybil cluster.

### 3.2 Maurer/luồng tin cậy độc lập

Engine lặp tìm đường tốt nhất, loại các cạnh đã dùng rồi tìm đường tiếp theo. Đây là heuristic tách đường độc lập theo cạnh, phù hợp để đánh giá dự phòng. Kết quả tổng hợp dùng xác suất ít nhất một đường thành công:

`1 - Π(1-Capacity(path_i))`.

Trong hệ thống production, nếu cần mô hình độc lập nghiêm ngặt hơn, có thể nâng cấp sang max-flow/min-cut có capacity và policy kiểm soát tương quan.

### 3.3 Articulation point

Đồ thị có hướng được chiếu thành đồ thị vô hướng vì SPoF là câu hỏi về kết nối dự phòng hai chiều. DFS Hopcroft–Tarjan duy trì `tin[u]` và `low[u]`. Một đỉnh không phải root là articulation point nếu tồn tại con `v` sao cho `low[v] >= tin[u]`; root là articulation point khi có trên một nhánh DFS con.

## 4. Thiết kế và luồng xử lý

```text
Packet Inspector / Trust Store
            |
            v
  Validate nodes, weights, types
            |
            +--> Dijkstra log-cost + hop decay --> best path
            |
            +--> Edge-disjoint repeated search --> independent paths
            |
            +--> Undirected projection + DFS --> SPoF list
            |
            v
  API response / audit ledger / D3 visualization
```

Các điều kiện fail-closed gồm node rỗng, weight ngoài `[0,1]`, gamma không dương và maxHops không phải số nguyên không âm.

## 5. Chi tiết hiện thực

Mã nguồn dùng Node.js Core, không thêm dependency runtime. Hàng đợi hiện tại là mảng có sắp xếp; phù hợp bản demo và có thể thay bằng binary min-heap khi đồ thị lớn. Đường đi không đi qua cạnh weight bằng 0. Tất cả input được sao chép/chuẩn hóa, không sửa dữ liệu gọi vào.

## 6. Kịch bản kiểm thử và kết quả

Bộ kiểm thử tại `test/wot-analyzer.test.js` chạy bằng `npm test` gồm:

| ID | Kịch bản | Kết quả |
|---|---|---|
| T01 | Ánh xạ 4 certification types | Pass |
| T02 | Gộp hai chứng thực song song | Pass |
| T03 | Chọn đường có capacity lớn nhất và hop decay | Pass |
| T04 | Từ chối đường vượt maxHops | Pass |
| T05 | Phát hiện B/C trong chuỗi A-B-C-D | Pass |
| T06 | Tách hai đường cạnh độc lập và gộp capacity | Pass |

Kết quả thực thi: **6 tests passed, 0 failed** trên Node.js v24.22.3/Windows 11 tại thời điểm chạy.

## 7. Độ phức tạp và an toàn

- Chuẩn hóa và xây adjacency: `O(E)`.
- Dijkstra bản hiện tại: `O((V+E) log E)` do sắp xếp hàng đợi mỗi vòng; binary heap production: `O((V+E) log V)`.
- Articulation points: `O(V+E)`.
- Tìm `p` đường cạnh độc lập: xấp xỉ `O(p × Dijkstra)`.
- Bộ nhớ: `O(V+E)`.

Đây là engine phân tích trust, không phải primitive mật mã. Không dùng fingerprint để tự suy ra tính hợp lệ chữ ký; chữ ký, hash và chứng chỉ phải được xác minh bởi các module chuyên trách. Không coi PageRank là trust tuyệt đối vì có nguy cơ Sybil và vì Web of Trust phụ thuộc trust anchor.


## 9. Hạn chế và hướng phát triển

1. Thay mảng priority queue bằng binary min-heap.
2. Hỗ trợ định danh cạnh để xử lý multiedge chính xác hơn trong edge-disjoint flow.
3. Bổ sung policy theo trust domain, thời hạn chứng thực, revocation và ownertrust.
4. Thêm property-based/fuzz testing, benchmark 10k–1M edges và giới hạn chống resource exhaustion.
5. Cung cấp adapter JSON/REST và dữ liệu cho D3.js, đồng thời ghi mọi quyết định trust vào audit ledger.

## 10. Kết luận

Module đã hiện thực đúng phạm vi: mô hình đồ thị WoT có hướng, tìm đường tin cậy theo negative-log Dijkstra với hop decay, đánh giá luồng độc lập và phát hiện SPoF. Mã nguồn có kiểm tra đầu vào, API tách biệt và bộ test tự động chạy đạt 6/6. Khi tích hợp toàn hệ thống, cần giữ ranh giới trách nhiệm: engine chỉ phân tích dữ liệu chứng thực đã được xác minh, không thay thế parser hoặc thư viện mật mã chuẩn.


