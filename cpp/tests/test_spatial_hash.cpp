// test_spatial_hash.cpp — native host golden test for cpp/src/spatial_hash.cpp.
//
// Replays tests/fixtures/spatial_hash/golden.txt (generated from the shipping
// AssemblyScript binary by scripts/gen-spatial-hash-golden.mjs) and requires
// identical hit ids in identical order for queryRadius, queryRadiusSimd and
// queryRadiusFirst. Native builds have no wasm SIMD, so queryRadiusSimd runs
// the scalar narrow phase here; the wasm SIMD lane path is covered by
// `npm run verify:cpp-wasm`.
//
//   test_spatial_hash <path/to/golden.txt>

#include "spatial_hash.h"

#include <cstdint>
#include <cstdio>
#include <cstring>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

namespace {

struct Entity { float x, y, z, r; int layer, id; };
struct Query { float x, y, z, r; int mask; };
struct CellCase { float cell; std::vector<std::vector<int>> hits; };

float hexF32(const std::string& h) {
    const uint32_t bits = static_cast<uint32_t>(std::stoul(h, nullptr, 16));
    float f;
    std::memcpy(&f, &bits, sizeof f);
    return f;
}

bool nextLine(std::istream& in, std::string& line) {
    while (std::getline(in, line)) {
        if (!line.empty() && line[0] != '#') return true;
    }
    return false;
}

std::vector<int> readHits(int n) {
    const int32_t* res = reinterpret_cast<const int32_t*>(getQueryResultPtr());
    return std::vector<int>(res, res + n);
}

std::string join(const std::vector<int>& v) {
    std::string s;
    for (size_t i = 0; i < v.size(); ++i) {
        if (i) s += ',';
        s += std::to_string(v[i]);
    }
    return s;
}

} // namespace

int main(int argc, char** argv) {
    if (argc < 2) {
        std::cerr << "usage: test_spatial_hash <golden.txt>\n";
        return 2;
    }
    std::ifstream in(argv[1]);
    if (!in) {
        std::cerr << "cannot open " << argv[1] << "\n";
        return 2;
    }

    std::string line, tag;
    std::vector<Entity> entities;
    std::vector<Query> queries;
    std::vector<CellCase> cases;

    nextLine(in, line);
    { std::istringstream ss(line); int n; ss >> tag >> n; entities.resize(n); }
    for (auto& e : entities) {
        nextLine(in, line);
        std::istringstream ss(line);
        std::string x, y, z, r;
        ss >> x >> y >> z >> r >> e.layer >> e.id;
        e.x = hexF32(x); e.y = hexF32(y); e.z = hexF32(z); e.r = hexF32(r);
    }
    nextLine(in, line);
    { std::istringstream ss(line); int n; ss >> tag >> n; queries.resize(n); }
    for (auto& q : queries) {
        nextLine(in, line);
        std::istringstream ss(line);
        std::string x, y, z, r;
        ss >> x >> y >> z >> r >> q.mask;
        q.x = hexF32(x); q.y = hexF32(y); q.z = hexF32(z); q.r = hexF32(r);
    }
    while (nextLine(in, line)) {
        std::istringstream ss(line);
        std::string cellHex;
        ss >> tag >> cellHex;
        CellCase c{hexF32(cellHex), {}};
        for (size_t k = 0; k < queries.size(); ++k) {
            nextLine(in, line);
            std::istringstream hs(line);
            int n;
            hs >> n;
            std::vector<int> ids(n);
            for (int& id : ids) hs >> id;
            c.hits.push_back(std::move(ids));
        }
        cases.push_back(std::move(c));
    }

    int failures = 0;
    size_t checked = 0;
    for (const auto& c : cases) {
        float* buf = reinterpret_cast<float*>(allocEntities(static_cast<int>(entities.size())));
        for (size_t i = 0; i < entities.size(); ++i) {
            const Entity& e = entities[i];
            float* o = buf + i * 6;
            o[0] = e.x; o[1] = e.y; o[2] = e.z; o[3] = e.r;
            o[4] = static_cast<float>(e.layer);
            o[5] = static_cast<float>(e.id);
        }
        rebuildGrid(c.cell);

        for (size_t k = 0; k < queries.size(); ++k) {
            const Query& q = queries[k];
            const std::vector<int>& want = c.hits[k];
            const std::vector<int> scalar = readHits(queryRadius(q.x, q.y, q.z, q.r, q.mask));
            const std::vector<int> simd = readHits(queryRadiusSimd(q.x, q.y, q.z, q.r, q.mask));
            const int first = queryRadiusFirst(q.x, q.y, q.z, q.r, q.mask);
            const int wantFirst = want.empty() ? -1 : want[0];
            ++checked;
            if (scalar != want || simd != want || first != wantFirst) {
                if (++failures <= 10) {
                    std::cerr << "FAIL cell=" << c.cell << " query#" << k
                              << " scalar=[" << join(scalar) << "] simd=[" << join(simd)
                              << "] first=" << first << " want=[" << join(want) << "]\n";
                }
            }
        }
    }

    if (failures > 0) {
        std::cerr << "❌ " << failures << "/" << checked << " golden queries diverge from AssemblyScript\n";
        return 1;
    }
    std::cout << "✅ C++ spatial hash matches AS golden (" << checked << " queries, "
              << cases.size() << " cell sizes)\n";
    return 0;
}
