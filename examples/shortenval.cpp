#include "dyno.h"
#include <string>
#include <vector>
#include <map>

int main()
{
    std::string shortword {"hello"};
    std::string longword{"1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890"};
    int * pi = new int(5);
    std::vector<int> v;
    std::vector<double> w {};
    v.push_back(1);
    v.push_back(2);
    w.push_back(3.0);
    w.push_back(3.141592);
    std::map<char, int> z {{'a', 1}, {'b', 2}, {'c', 3}};
    std::cout << z['a'] << "\n";
    delete pi;
}
