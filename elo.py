import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import exponnorm

# Your data
with open('output.txt', 'r') as f:
    data = np.array([float(line.strip()) for line in f if line.strip()])

def emg_elo_score(x, mu, sigma, _lambda):
    """
    Convert a value x to a unitless ELO-style score using EMG parameters.
    """
    # Step 1: Z-score
    z = (x - mu) / sigma

    # Step 2: Skew correction (optional)
    skew_correction = np.sign(z) * np.abs(z) ** (1 / (1 + _lambda * sigma))

    # Step 3: Scale to a standard ELO-style base (e.g., 1500 + offset)
    elo = 1500 + skew_correction * 150  # Change 200 to control scale
    return elo

# Fit the data using exponnorm
# exponnorm takes K = lambda * sigma, loc = mu, scale = sigma
K, loc, scale = exponnorm.fit(data)

# Generate fitted curve
x = np.linspace(min(data), max(data), 1000)
pdf_fitted = exponnorm.pdf(x, K, loc, scale)

# Plotting
plt.figure(figsize=(8, 5))
plt.hist(data, bins=30, density=True, alpha=0.6, color='skyblue', label='Data Histogram')
plt.plot(x, pdf_fitted, 'r-', label='Fitted EMG PDF')
plt.title('Fitting Exponentially Modified Gaussian')
plt.xlabel('Value')
plt.ylabel('Density')
plt.legend()
plt.grid(True)
plt.show()

# Print parameters
mu = loc
sigma = scale
_lambda = 1 / (K * sigma)
print(f"mu (mean): {mu}")
print(f"sigma (std): {sigma}")
print(f"lambda (exp rate): {_lambda}")

for i in range(len(data)):
    print(f"Original: {data[i]:.2f} -> ELO: {emg_elo_score(data[i], mu, sigma, _lambda):.2f}")
print()
