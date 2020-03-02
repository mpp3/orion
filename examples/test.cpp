#include <iostream>
#include <vector>

std::vector<int> sequence(int from, int limit, int step) {
  std::vector<int> result;
  int x {from};
  while (x <= limit) {
    result.push_back(x);
    x += step;
  }
  return result;
}

int factorial(int n) {
  if (n == 0) {
    return 1;
  }
  else {
    return n * factorial(n - 1);
  }
}

int power(int base, int exponent) {
  int result {1};
  for (int i {0}; i < exponent; ++i) {
    result *= base;
  }
  return result;
}

int main()
{
  int x {5};
  std::cout << factorial(x) << "\n";
  {
    int x {2};
    int y {10};
    std::vector<int> seq;
    seq = sequence(x, y, 2);
  }
  int e {4};
  std::cout << power(x, e) << "\n";
}
