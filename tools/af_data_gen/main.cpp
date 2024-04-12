/**
 * Code used to generate manual values for 'correctly rounded' AbstractFloat
 * tests in the CTS.
 *
 * These are generated in a C++ program, because it allows for easy access to
 * higher than 64-bit floating point numbers (specifically 128-bit), which
 * allows for calculating roundings when infinitely precise calculations are not
 * precisely representable in 64-bit floats. This gets around the fact that
 * numbers in Typescript are internally 64-bits, thus making it difficult to
 * detect when rounding occurs for AbstractFloats without importing a higher
 * precision floating point library.
 *
 * This codes is not meant to be automatically built/used by the CTS, but
 * instead is a reference for how the values in af_data.ts were generated
 */
#include <cassert>
#include <cstdint>
#include <iostream>
#include <cfenv>
#include <format>
#include <iomanip>
#include <cmath>
#include <map>
#include <memory>
#include <set>
#include <vector>

/** The 'magic' that allows for calculating both roundings */
// #pragma STDC FENV_ACCESS ON

/** Magic constants that should match the entries in constants.ts's kBit.f64 */
constexpr double kF64NegativeMin = std::bit_cast<double>(0xFFEFFFFFFFFFFFFFull);
constexpr double kF64NegativeMax = std::bit_cast<double>(0x8010000000000000ull);
constexpr double kF64NegativeSubnormalMin = std::bit_cast<double>(0x800FFFFFFFFFFFFFull);
constexpr double kF64NegativeSubnormalMax = std::bit_cast<double>(0x8000000000000001ull);
constexpr double kF64PositiveSubnormalMin = std::bit_cast<double>(0x0000000000000001ull);
constexpr double kF64PositiveSubnormalMax = std::bit_cast<double>(0x000FFFFFFFFFFFFFull);
constexpr double kF64PositiveMin = std::bit_cast<double>(0x0010000000000000ull);
constexpr double kF64PositiveMax = std::bit_cast<double>(0x7FEFFFFFFFFFFFFFull);

/**
 * Mapping from Numeric value -> TS representation, should include all the
 * values that appear in kInterestingF64Values in math.ts
 */
const std::map<double, std::string> kInterestingF64s = {
    { kF64NegativeMin, "kValue.f64.negative.min" },
    { -10.0, "-10.0" },
    { -1.0, "-1.0" },
    { -0.125, "-0.125" },
    { kF64NegativeMax, "kValue.f64.negative.max"},
    { kF64NegativeSubnormalMin, "kValue.f64.negative.subnormal.min" },
    { kF64NegativeSubnormalMax, "kValue.f64.negative.subnormal.max" },
    { 0.0, "0.0" },
    { kF64PositiveSubnormalMin, "kValue.f64.positive.subnormal.min" },
    { kF64PositiveSubnormalMax, "kValue.f64.positive.subnormal.max" },
    { kF64PositiveMin, "kValue.f64.positive.min" },
    { 0.125, "0.125" },
    { 1.0, "1.0" },
    { 10.0, "10.0" },
    { kF64PositiveMax, "kValue.f64.positive.max"}
};

/**
 * Print out a string representation of a specific value that can be copied in
 * a CTS test
 */
std::string printAbstractFloat(const double val) {
    if (!std::isfinite(val)) {
        if (val > 0) {
            return "kValue.f64.positive.infinity";
        }
        if (val < 0) {
            return "kValue.f64.negative.infinity";
        }
        assert("Generated a NaN");
    }

    if (const auto iter = kInterestingF64s.find(val); iter != kInterestingF64s.end()) {
        return iter->second;
    }

    std::stringstream ss;
    // Print 'easy' to read decimal and integers as literals, otherwise dump the hex value
    if ( fabs(val) > 0.1 && fabs(val) < 100000) {
        ss << val;
    } else {
        ss << "reinterpretU64AsF64(0x" << std::hex << std::setfill('0') << std::setw(16) << std::bit_cast<uint64_t>(val) << "n) /* ~" << val << " */";
    }
    return ss.str();
}

/** Could this value potentially be affected by FTZ behaviour */
bool couldBeFlushed(const double val) {
    return  std::fpclassify(val) == FP_SUBNORMAL;
}

/**
 * Generate the 64-bit float interval that a higher precision value will
 * quantized down to.
 *
 * If the value if exactly representable in 64-bit floating point this will be
 * a singular value, otherwise it will be the two 64-bit values nearest to the
 * value.
 *
 * This is done via manipulating the global process rounding mode, thus this
 * code is non-reentrant, so should not be used in concurrent/asynchronous
 * processes.
 */
std::tuple<double, double> quantizeToAbstractFloat(const long double val) {
    const int round_mode = fegetround();

    fesetround(FE_DOWNWARD);
    const auto downward = static_cast<double>(val);
    fesetround(FE_UPWARD);
    const auto upward = static_cast<double>(val);

    fesetround(round_mode);

    return { downward, upward };
}

/**
 * Generates a string for a binary operation that can be copied into a CTS test
 * file
 */
std::string printBinaryCase(const std::string &lhs, const std::string &rhs, const std::vector<double> &result) {
    assert(!result.empty());
    std::stringstream ss;
    ss << "{ lhs: ";
    ss << lhs;
    ss << ", rhs: ";
    ss << rhs;
    ss << ", ";
    ss << "expected: [ ";
    if (!result.empty()) {
        for (auto i = 0; i < result.size() - 1; i++) {
            ss << "" << printAbstractFloat(result[i]) << ", ";
        }
        ss << printAbstractFloat(result.back());
    }
    ss << " ] }";
    return ss.str();
}

/** Function that performs a binary operation, i.e. addition, etc */
typedef long double (*BinaryOp)(long double, long double);

const BinaryOp kAdditionOp= [](const long double lhs, const long double rhs) {
    return lhs + rhs;
};

/**
 * Generates a string, that can be copied into a CTS test file, for all of the
 * tests cases for a binary operation.
 */
std::string printBinaryOpCases(const BinaryOp op, const std::string& name) {
    std::stringstream ss;
    ss << "BEGIN " << name << " CASES" << std::endl;
    for (const auto& [lhs, lhs_str] : kInterestingF64s) {
        for (const auto& [rhs, rhs_str] : kInterestingF64s) {
            std::set<double> results;
            {
                const auto [downward, upward] = quantizeToAbstractFloat(op(lhs, rhs));
                results.insert(downward);
                results.insert(upward);
            }

            // CTS needs to consider that subnormals may be flushed to zero at
            // any point, so applying potential flushings to get additional
            // results.
            if (couldBeFlushed(lhs)) {
                const auto [downward, upward] = quantizeToAbstractFloat(op(0.0, rhs));
                results.insert(downward);
                results.insert(upward);
            }

            if (couldBeFlushed(rhs)) {
                const auto [downward, upward] = quantizeToAbstractFloat(op(lhs, 0.0));
                results.insert(downward);
                results.insert(upward);
            }

            if (couldBeFlushed(lhs), couldBeFlushed(rhs)) {
                const auto [downward, upward] = quantizeToAbstractFloat(op(0.0, 0.0));
                results.insert(downward);
                results.insert(upward);
            }

            ss << printBinaryCase(lhs_str, rhs_str, std::vector(results.begin(), results.end())) << "," << std::endl;
        }
    }
    ss << "END " << name << " CASES" << std::endl;
    return ss.str();
}

int main() {
    assert(sizeof(double) < sizeof(long double) && "Need higher precision long double");
    assert(sizeof(long double) == 16 && "Code assume 'proper' quad support, not some other higher precision floating point implementation");

    {
        // Confirm that calculating f64 imprecise results generates two possible
        // roundings.
        const auto [begin, end] =
            quantizeToAbstractFloat(static_cast<long double>(0.1) * static_cast<long double>(0.1));
        assert(std::bit_cast<uint64_t>(begin) == 0x3F847AE147AE147bull &&
            std::bit_cast<uint64_t>(end) == 0x3F847AE147AE147Cull &&
            "0.1 * 0.1 returned unexpected values");
    }

    std::cout << printBinaryOpCases(kAdditionOp, "ADDITION") << std::endl;
    return 0;
}
