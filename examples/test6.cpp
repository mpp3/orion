#include "dyno.h"
#include <string>

int main()
{
    std::string shortword {"hello"};
    std::string longword{"12345678901234567890123456789012345678912345678901234567890123456789012345678900"};
    int * pi = new int(5);
    delete pi;
}