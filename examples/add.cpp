#include <iostream>

void printadd(int &v)
{
  std::cout << v << ": " << &v << "\n";
}

void f()
{
  int z {4};
  int w {5};
  printadd(z);
  printadd(w);
}

void g()
{
  int t {3};
  printadd(t);
  f();
}

int main()
{
  int x {1};
  int y {2};
  printadd(x);
  printadd(y);
  g();
}
