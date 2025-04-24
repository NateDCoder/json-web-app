import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import exponnorm, norm
# type: ignore

from bisect import bisect_left
from typing import Callable, List

from scipy.stats import expon, exponnorm

NORM_MEAN = 1500
NORM_SD = 250

def epa_to_unitless_epa(epa: float, mean: float, sd: float) -> float:
    return NORM_MEAN + NORM_SD * (epa - mean) / sd


# For converting EPA to Norm EPA
distrib = exponnorm(1.6, -0.3, 0.2)

def get_epa_to_norm_epa_func(year_epas: List[float]) -> Callable[[float], float]:
    desc_sorted_epas = sorted(year_epas, reverse=True)
    total_N, cutoff_N = len(desc_sorted_epas), int(len(desc_sorted_epas) / 25)
    print(total_N, cutoff_N)
    exponnorm_disrib = expon_distrib = None
    if total_N > 0:
        exponnorm_disrib = exponnorm(*exponnorm.fit(desc_sorted_epas))
    if cutoff_N > 0:
        expon_distrib = expon(*expon.fit(desc_sorted_epas[:cutoff_N]))

    sorted_epas = desc_sorted_epas[::-1]

    def _get_norm_epa(epa: float) -> float:
        i = total_N - bisect_left(sorted_epas, epa)
        exponnorm_value: float = exponnorm_disrib.cdf(epa)
        percentile = exponnorm_value
        if i < cutoff_N:
            expon_value: float = expon_distrib.cdf(epa)
            expon_value = 1 - cutoff_N / total_N * (1 - expon_value)
            # Linearly interpolate between the two distributions from 10% to 5%
            expon_frac = min(1, 2 * (cutoff_N - i) / cutoff_N)
            percentile = expon_frac * expon_value + (1 - expon_frac) * exponnorm_value
        out: float = distrib.ppf(percentile)
        return NORM_MEAN + NORM_SD * out

    # get quantiles of year_epas, and linearly interpolate between norm_epas
    quantiles = [sorted_epas[((total_N - 1) * i) // 100] for i in range(101)]
    quantile_norm_epas = [_get_norm_epa(epa) for epa in quantiles]

    def get_norm_epa(epa: float) -> float:
        i = bisect_left(quantiles, epa)
        if i == 0:
            return quantile_norm_epas[0]
        if i == 101:
            return quantile_norm_epas[100]

        x0 = quantiles[i - 1]
        x1 = quantiles[i]
        y0 = quantile_norm_epas[i - 1]
        y1 = quantile_norm_epas[i]

        return y0 + (y1 - y0) * (epa - x0) / (x1 - x0)

    return get_norm_epa

# Your data
with open('2024 elos.txt', 'r') as f:
    data = np.array([float(line.strip()) for line in f if line.strip()])

# Fit the data using exponnorm
# exponnorm takes K = lambda * sigma, loc = mu, scale = sigma
K, loc, scale = exponnorm.fit(data)
emg_elo_score = get_epa_to_norm_epa_func(data)

for i in range(len(data)):
    print(f"Original: {data[len(data)-1-i]:.2f} -> ELO: {emg_elo_score(data[len(data)-1-i]):.2f}")
print("STD:",  np.std(data))
print("MEAN:",  np.mean(data))

# Generate fitted curve
x = np.linspace(min(data), max(data), 1000)
pdf_fitted = exponnorm.pdf(x, K, loc, scale)

mean = np.mean(data)
std = np.std(data)
pdf_normal = norm.pdf(x, loc=60, scale=std)

# Plotting
plt.figure(figsize=(8, 5))
plt.hist(data, bins=30, density=True, alpha=0.6, color='skyblue', label='Data Histogram')
plt.plot(x, pdf_fitted, 'r-', label='Fitted EMG PDF')
plt.plot(x, pdf_normal, 'g--', label='Normal Distribution')

plt.title('Fitting EPA graphs')
plt.xlabel('Value')
plt.ylabel('Density')
plt.legend()
plt.grid(True)
plt.show()
