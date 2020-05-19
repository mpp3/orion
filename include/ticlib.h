// Defines some functions to make it easy for begginers to write first programs
// Functions defined:
// - to_string(t): converts an object 't' to a string
// - error(s): shows error message 's' and finishes the program
// - error(s, s2): shows error message 's'+'s2' and finishes the program
// - keep_window_open(): shows 'Please enter a character to exit' and waits for that char
// - keep_winwow_open(s): shows message 's' and waits for a char from the user
// - now(): returns the current time and date
// - pow2(base): returns 'base' squared
// - random_int(min, max): returns a random int between 'min' and 'max'
// - random_double(min, max): returns a random double between 'min' and 'max'
// - sort(c): sorts the elements of 'c' (a container) using the '<' operator
// - sort(c, p): sorts the elements of 'c' (a container) using the predicate 'p'
// - find(c, v): searches for value 'v' in container 'c'; returns an iterator
// - find_if(c, v, p): searches for value 'v' among the elements of 'c' for which 'p' is true

// Release 0.3

#ifndef _ticlib_h
#define _ticlib_h

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdlib>
#include <ctime>
#include <forward_list>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <list>
#include <map>
#include <random>
#include <regex>
#include <sstream>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <vector>
#include <vector>

using namespace std;

// Converts an object of any type to a string
template<class T> string to_string(const T& t)
{
	ostringstream os;
	os << t;
	return os.str();
}

struct Exit : runtime_error {
	Exit(): runtime_error("Exit") {}
};

// error() simply disguises throws:
inline void error(const string& s)
{
	throw runtime_error(s);
}

inline void error(const string& s, const string& s2)
{
	error(s+s2);
}

inline void error(const string& s, int i)
{
	ostringstream os;
	os << s <<": " << i;
	error(os.str());
}


template<class T> char* as_bytes(T& i)	// needed for binary I/O
{
	void* addr = &i;	// get the address of the first byte
						// of memory used to store the object
	return static_cast<char*>(addr); // treat that memory as bytes
}


// Shows a message on the console and waits for the user to enter a character
// Useful to keep the console open to see the results of our program
inline void keep_window_open()
{
  cin.clear();
  cout << "Please, press Enter to continue...\n";
  cin.ignore(cin.rdbuf()->in_avail(), '\n');
  getchar();
  return;
}

inline void keep_window_open(string s)
{
	if (s=="") return;
	cin.clear();
	cin.ignore(120,'\n');
	for (;;) {
		cout << "Please enter " << s << " to exit\n";
		string ss;
		while (cin >> ss && ss!=s)
			cout << "Please enter " << s << " to exit\n";
		return;
	}
}

// Returns the system time
inline time_t now() {
  return time(nullptr);
}

// Returns 'base' squared
inline double pow2(double base) {
  return base*base;
}

const int DEFAULT_MIN_RANDOM_INT = 0;
const int DEFAULT_MAX_RANDOM_INT = 10;

// Returns a random int between 'min' and 'max'
// If 'min' and 'max' are not specified, the range is 0..10

inline int random_int(int min = DEFAULT_MIN_RANDOM_INT, int max = DEFAULT_MAX_RANDOM_INT)
{
  if (min <= max) {
    std::uniform_int_distribution<int> distribution(min, max);
    std::random_device rd;
    std::mt19937 random_generator(rd());
    return distribution(random_generator);
  }
  else {
    throw "random_int: lower bound is greater than upper bound";
  }
}

const double DEFAULT_MIN_RANDOM_DOUBLE = 0.0;
const double DEFAULT_MAX_RANDOM_DOUBLE = 1.0;

// Returns a random double between 'min' and 'max'
// If 'min' and 'max' are not specified, the range is 0..10

inline double random_double(double min = DEFAULT_MIN_RANDOM_DOUBLE, double max = DEFAULT_MAX_RANDOM_DOUBLE)
{
  if (min <= max) {
    std::uniform_real_distribution<double> distribution(min, max);
    std::random_device rd;
    std::mt19937 random_generator(rd());
    return distribution(random_generator);
  }
  else {
    throw "random_double: lower bound is greater than upper bound";
  }
}


template<typename C>
using Value_type = typename C::value_type;

template<typename C>
using Iterator = typename C::iterator;

// Sorts the elements of a Container 'c' using the '<' operator
template<typename C>
	// requires Container<C>()
void sort(C& c)
{
	std::sort(c.begin(), c.end());
}

// Sorts the elements of a Container 'c' using 'p' as predicate
template<typename C, typename Pred>
// requires Container<C>() && Binary_Predicate<Value_type<C>>()
void sort(C& c, Pred p)
{
	std::sort(c.begin(), c.end(), p);
}

// Finds the value 'v' in Container 'c'
// Returns an iterator to the element found
template<typename C, typename Val>
	// requires Container<C>() && Equality_comparable<C,Val>()
Iterator<C> find(C& c, Val v)
{
	return std::find(c.begin(), c.end(), v);
}

// Finds the value 'v' among the elements of Container 'c' for which 'p' is true
template<typename C, typename Pred>
// requires Container<C>() && Predicate<Pred,Value_type<C>>()
Iterator<C> find_if(C& c, Pred p)
{
	return std::find_if(c.begin(), c.end(), p);
}

#endif
